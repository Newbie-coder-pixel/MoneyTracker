import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Pencil, Plus, SkipForward, Zap } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { IconBadge } from '../../components/IconBadge'
import { AmountInput } from '../../components/Pickers'
import { showToast } from '../../components/toast'
import { useCategoryMap, useWalletMap } from '../../db/hooks'
import { confirmOccurrence, setRecurringPaused, skipOccurrence } from '../../db/recurring'
import { db } from '../../db/schema'
import type { Recurring, RecurringOccurrence } from '../../db/types'
import { diffDays, formatDayShort, todayKey } from '../../lib/dates'
import { formatRupiah } from '../../lib/money'
import { describeSchedule, monthlyEquivalent, nextOccurrence } from '../../lib/recurring'
import { schedulePushUpdate } from '../../pwa/push'
import { refreshReminders } from '../reminders/refresh'

type Filter = 'all' | 'expense' | 'income' | 'transfer'

export function RecurringPage() {
  const categories = useCategoryMap()
  const wallets = useWalletMap()
  const [filter, setFilter] = useState<Filter>('all')
  const data = useLiveQuery(async () => {
    const [schedules, pending] = await Promise.all([db.recurring.toArray(), db.recurringOccurrences.where('status').equals('pending').toArray()])
    return { schedules, pending: pending.sort((a, b) => (a.date < b.date ? -1 : 1)) }
  })
  const today = todayKey()

  if (!data) return <AppHeader title="Transaksi Rutin" back />
  const byId = new Map(data.schedules.map((s) => [s.id, s]))
  const active = data.schedules.filter((s) => !s.paused)
  const monthlyTotal = active.filter((s) => s.template.type === 'expense').reduce((sum, s) => sum + monthlyEquivalent(s, s.template.amount), 0)
  const list = data.schedules
    .filter((s) => filter === 'all' || s.template.type === filter)
    .map((s) => ({ s, next: s.paused ? null : nextOccurrence(s, today) }))
    .sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999'))

  const afterChange = () => {
    void refreshReminders()
    schedulePushUpdate()
  }

  return (
    <>
      <AppHeader
        title="Transaksi Rutin"
        back
        actions={
          <Link to="/lainnya/rutin/baru" className="flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">
            <Plus className="size-4" aria-hidden="true" /> Jadwal
          </Link>
        }
      />
      <main className="space-y-4 p-4">
        {data.pending.length > 0 && (
          <section className="space-y-2">
            <h2 className="label-caps">Perlu dikonfirmasi · {data.pending.length}</h2>
            {data.pending.map((o) => {
              const s = byId.get(o.recurringId)
              return s ? <PendingCard key={o.id} occurrence={o} schedule={s} categoryName={categories.get(s.template.categoryId ?? '')?.name} walletName={wallets.get(s.template.walletId)?.name} onDone={afterChange} /> : null
            })}
          </section>
        )}

        <section className="rounded-xl border border-border bg-surface p-4">
          <p className="label-caps">Total pengeluaran rutin</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {formatRupiah(monthlyTotal)} <span className="text-sm font-normal text-text-muted">/ bulan</span>
          </p>
          <p className="text-sm text-text-muted">
            {active.length} jadwal aktif · {active.filter((s) => s.mode === 'auto').length} otomatis · {active.filter((s) => s.mode === 'confirm').length} minta konfirmasi
          </p>
        </section>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {(
            [
              ['all', 'Semua'],
              ['expense', 'Pengeluaran'],
              ['income', 'Pemasukan'],
              ['transfer', 'Transfer'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-[13px] ${filter === f ? 'border-primary bg-primary font-semibold text-on-primary' : 'border-border bg-surface font-medium text-text-muted'}`}
            >
              {label} ({f === 'all' ? data.schedules.length : data.schedules.filter((s) => s.template.type === f).length})
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-text-muted">
            Belum ada jadwal. Tambahkan kos, langganan, atau cicilan agar tercatat otomatis.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map(({ s, next }) => {
              const c = categories.get(s.template.categoryId ?? '')
              const days = next ? diffDays(today, next) : null
              return (
                <li key={s.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <IconBadge icon={c?.icon ?? (s.template.type === 'transfer' ? 'wallet' : 'ellipsis')} color={c?.color ?? '#0d9488'} />
                    <Link to={`/lainnya/rutin/${s.id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block text-xs text-text-muted">{describeSchedule(s)}</span>
                    </Link>
                    <label className="flex min-h-11 items-center" aria-label={s.paused ? `Lanjutkan ${s.name}` : `Jeda ${s.name}`}>
                      <input
                        type="checkbox"
                        checked={!s.paused}
                        onChange={(e) => void setRecurringPaused(s.id, !e.target.checked).then(afterChange)}
                        className="size-5 accent-primary"
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5">
                      {s.mode === 'auto' ? <Zap className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
                      {s.mode === 'auto' ? 'Otomatis' : 'Konfirmasi'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${days === 0 ? 'bg-expense-soft text-expense' : 'text-text-muted'}`}>
                      {s.paused ? 'Dijeda' : next ? (days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days} hari lagi (${formatDayShort(next)})`) : 'Selesai'}
                    </span>
                    <span className={`ml-auto text-[15px] font-semibold ${s.template.type === 'income' ? 'text-income' : s.template.type === 'expense' ? 'text-expense' : ''}`}>
                      {s.template.type === 'income' ? '+' : s.template.type === 'expense' ? '-' : ''}
                      {formatRupiah(s.template.amount)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}

function PendingCard({
  occurrence,
  schedule,
  categoryName,
  walletName,
  onDone,
}: {
  occurrence: RecurringOccurrence
  schedule: Recurring
  categoryName?: string
  walletName?: string
  onDone: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState(schedule.template.amount)

  const record = async (override?: number) => {
    await confirmOccurrence(occurrence.id, override)
    showToast(`${schedule.name} dicatat`)
    onDone()
  }

  return (
    <div className="card p-4">
      <p className="text-xs text-text-muted">
        {occurrence.date === todayKey() ? 'Jatuh tempo hari ini' : `Jatuh tempo ${formatDayShort(occurrence.date)}`}
      </p>
      <p className="font-semibold">{schedule.name}</p>
      <p className="text-sm text-text-muted">{[categoryName, walletName].filter(Boolean).join(' · ')}</p>
      {editing ? (
        <div className="mt-2">
          <AmountInput value={amount} onChange={setAmount} />
        </div>
      ) : (
        <p className="mt-2 text-2xl font-bold tabular-nums">{formatRupiah(schedule.template.amount)}</p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-[13px] font-semibold">
        <button
          type="button"
          disabled={editing && amount <= 0}
          onClick={() => void record(editing ? amount : undefined)}
          className="flex min-h-11 items-center justify-center gap-1 rounded-full bg-primary text-on-primary disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden="true" /> Catat
        </button>
        <button type="button" onClick={() => setEditing(!editing)} className="flex min-h-11 items-center justify-center gap-1 rounded-full border border-border active:bg-surface-muted">
          <Pencil className="size-4" aria-hidden="true" /> {editing ? 'Batal' : 'Ubah nominal'}
        </button>
        <button
          type="button"
          onClick={() => void skipOccurrence(occurrence.id).then(() => {
            showToast('Dilewati')
            onDone()
          })}
          className="flex min-h-11 items-center justify-center gap-1 rounded-full border border-border active:bg-surface-muted"
        >
          <SkipForward className="size-4" aria-hidden="true" /> Lewati
        </button>
      </div>
    </div>
  )
}
