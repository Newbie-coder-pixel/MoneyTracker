import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { AmountInput, ConfirmButton, Field, inputClass } from '../../components/Pickers'
import { showToast } from '../../components/toast'
import { useCategories, useWallets } from '../../db/hooks'
import { deleteRecurring, processRecurring, saveRecurring } from '../../db/recurring'
import { db } from '../../db/schema'
import type { Frequency, Recurring, RecurringTemplate } from '../../db/types'
import { isoWeekday, parseDateKey, todayKey } from '../../lib/dates'
import { describeSchedule } from '../../lib/recurring'
import { validateTransaction } from '../../lib/validation'
import { schedulePushUpdate } from '../../pwa/push'
import { refreshReminders } from '../reminders/refresh'

export function RecurringFormPage() {
  const { id } = useParams()
  const existing = useLiveQuery(async () => (id ? ((await db.recurring.get(id)) ?? null) : null), [id])
  if (id && existing === undefined) return <AppHeader title="Ubah Jadwal" back />
  return <RecurringForm key={id ?? 'new'} existing={existing ?? undefined} />
}

const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const FREQUENCIES: { value: Frequency; label: string; unit: string }[] = [
  { value: 'daily', label: 'Harian', unit: 'hari' },
  { value: 'weekly', label: 'Mingguan', unit: 'minggu' },
  { value: 'monthly', label: 'Bulanan', unit: 'bulan' },
  { value: 'yearly', label: 'Tahunan', unit: 'tahun' },
]

function RecurringForm({ existing }: { existing?: Recurring }) {
  const navigate = useNavigate()
  const categories = useCategories() ?? []
  const wallets = (useWallets() ?? []).filter((w) => !w.archived || w.id === existing?.template.walletId || w.id === existing?.template.toWalletId)
  const today = todayKey()
  const start = existing?.startDate ?? today

  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<RecurringTemplate['type']>(existing?.template.type ?? 'expense')
  const [amount, setAmount] = useState(existing?.template.amount ?? 0)
  const [categoryId, setCategoryId] = useState(existing?.template.categoryId ?? '')
  const [walletId, setWalletId] = useState(existing?.template.walletId ?? '')
  const [toWalletId, setToWalletId] = useState(existing?.template.toWalletId ?? '')
  const [note, setNote] = useState(existing?.template.note ?? '')
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'monthly')
  const [interval, setIntervalCount] = useState(existing?.interval ?? 1)
  const [dayOfWeek, setDayOfWeek] = useState(existing?.dayOfWeek ?? isoWeekday(start))
  const [dayOfMonth, setDayOfMonth] = useState(existing?.dayOfMonth ?? parseDateKey(start).day)
  const [monthOfYear, setMonthOfYear] = useState(existing?.monthOfYear ?? parseDateKey(start).month)
  const [startDate, setStartDate] = useState(start)
  const [endMode, setEndMode] = useState<'never' | 'date' | 'count'>(existing?.maxCount ? 'count' : existing?.endDate ? 'date' : 'never')
  const [endDate, setEndDate] = useState(existing?.endDate ?? '')
  const [maxCount, setMaxCount] = useState(existing?.maxCount ?? 12)
  const [mode, setMode] = useState<Recurring['mode']>(existing?.mode ?? 'confirm')
  const [error, setError] = useState<string | null>(null)

  const kindCategories = categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense') && (!c.archived || c.id === categoryId))
  const effectiveWallet = walletId || wallets[0]?.id || ''
  // No silent default: a schedule filed under the wrong category skews every chart.
  const effectiveCategory = type === 'transfer' ? undefined : categoryId || undefined
  const schedule = {
    frequency,
    interval,
    dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
    dayOfMonth: frequency === 'monthly' || frequency === 'yearly' ? dayOfMonth : undefined,
    monthOfYear: frequency === 'yearly' ? monthOfYear : undefined,
    startDate,
    endDate: endMode === 'date' && endDate ? endDate : undefined,
    maxCount: endMode === 'count' ? maxCount : undefined,
  }

  const save = async () => {
    const template: RecurringTemplate = {
      type,
      amount,
      categoryId: effectiveCategory,
      walletId: effectiveWallet,
      toWalletId: type === 'transfer' ? toWalletId || wallets.find((w) => w.id !== effectiveWallet)?.id : undefined,
      note: note.trim(),
    }
    const problem = !name.trim() ? 'Beri nama jadwal, misal "Kos"' : validateTransaction(template)
    if (problem) return setError(problem)
    await saveRecurring({ name: name.trim(), template, ...schedule, mode }, existing?.id)
    const { created, pending } = await processRecurring()
    await refreshReminders()
    schedulePushUpdate()
    showToast(existing ? 'Jadwal diperbarui' : created + pending ? `Jadwal disimpan · ${created + pending} kejadian diproses` : 'Jadwal disimpan')
    navigate('/lainnya/rutin', { replace: true })
  }

  return (
    <>
      <AppHeader title={existing ? 'Ubah Jadwal' : 'Jadwal Baru'} back />
      <main className="space-y-5 p-4">
        <Field label="Nama">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Misal: Kos, Netflix, Cicilan HP" className={inputClass} />
        </Field>

        <div role="group" aria-label="Jenis" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface-muted p-1">
          {(
            [
              ['expense', 'Pengeluaran'],
              ['income', 'Pemasukan'],
              ['transfer', 'Transfer'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => {
                setType(t)
                setCategoryId('')
              }}
              className={`min-h-11 rounded-full text-sm font-semibold ${type === t ? 'bg-primary text-on-primary' : 'text-text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <Field label="Nominal">
          <AmountInput value={amount} onChange={setAmount} />
        </Field>

        {type !== 'transfer' && (
          <Field label="Kategori">
            <select value={effectiveCategory ?? ''} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              <option value="" disabled>
                Pilih kategori
              </option>
              {kindCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-3' : ''}>
          <Field label={type === 'transfer' ? 'Dari dompet' : 'Dompet'}>
            <select value={effectiveWallet} onChange={(e) => setWalletId(e.target.value)} className={inputClass}>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          {type === 'transfer' && (
            <Field label="Ke dompet">
              <select value={toWalletId || wallets.find((w) => w.id !== effectiveWallet)?.id} onChange={(e) => setToWalletId(e.target.value)} className={inputClass}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="Catatan (opsional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} className={inputClass} />
        </Field>

        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frekuensi">
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={inputClass}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Setiap">
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  inputMode="numeric"
                  value={interval}
                  onChange={(e) => setIntervalCount(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                  className="min-h-12 w-16 rounded-xl border border-border bg-surface px-3 text-center outline-none focus-visible:border-text"
                />
                <span className="text-text-muted">{FREQUENCIES.find((f) => f.value === frequency)?.unit}</span>
              </div>
            </Field>
          </div>

          {frequency === 'weekly' && (
            <Field label="Hari">
              <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className={inputClass}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(frequency === 'monthly' || frequency === 'yearly') && (
            <div className={frequency === 'yearly' ? 'grid grid-cols-2 gap-3' : ''}>
              {frequency === 'yearly' && (
                <Field label="Bulan">
                  <select value={monthOfYear} onChange={(e) => setMonthOfYear(Number(e.target.value))} className={inputClass}>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Tanggal" hint={dayOfMonth >= 29 ? 'Di bulan yang lebih pendek, jatuh ke hari terakhir bulan itu.' : undefined}>
                <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className={inputClass}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Tgl {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <Field label="Mulai" hint={!existing && startDate < today ? 'Kejadian sejak tanggal mulai akan langsung diproses saat disimpan.' : undefined}>
            <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className={inputClass} />
          </Field>

          <Field label="Berakhir">
            <select value={endMode} onChange={(e) => setEndMode(e.target.value as typeof endMode)} className={inputClass}>
              <option value="never">Tidak pernah</option>
              <option value="date">Pada tanggal</option>
              <option value="count">Setelah sejumlah kali</option>
            </select>
          </Field>
          {endMode === 'date' && <input type="date" aria-label="Tanggal berakhir" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />}
          {endMode === 'count' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={999}
                inputMode="numeric"
                value={maxCount}
                onChange={(e) => setMaxCount(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
                className="min-h-12 w-20 rounded-xl border border-border bg-surface px-3 text-center outline-none focus-visible:border-text"
              />
              kali
            </label>
          )}
          <p className="text-sm font-medium text-accent">{describeSchedule(schedule)}</p>
        </section>

        <fieldset className="space-y-2">
          <legend className="label-caps mb-2">Cara mencatat</legend>
          {(
            [
              ['confirm', 'Minta konfirmasi', 'Muncul di "Perlu dikonfirmasi"; kamu pilih Catat, Ubah nominal, atau Lewati.'],
              ['auto', 'Otomatis', 'Langsung dicatat saat jatuh tempo.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className={`flex items-start gap-3 rounded-xl p-4 ${mode === value ? 'border border-primary bg-surface-muted' : 'border border-border bg-surface'}`}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-5 accent-primary" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {existing && <p className="text-xs text-text-muted">Perubahan hanya berlaku untuk kejadian berikutnya; transaksi yang sudah tercatat tidak berubah.</p>}
        {error && (
          <p role="alert" className="rounded-xl border border-expense/30 bg-expense-soft px-4 py-3 text-sm text-expense">
            {error}
          </p>
        )}
        <button type="button" onClick={() => void save()} className="min-h-13 w-full rounded-full bg-primary text-base font-semibold text-on-primary">
          Simpan jadwal
        </button>
        {existing && (
          <ConfirmButton
            label={
              <>
                <Trash2 className="size-5" aria-hidden="true" /> Hapus jadwal
              </>
            }
            confirmLabel="Ketuk lagi untuk menghapus"
            onConfirm={async () => {
              await deleteRecurring(existing.id)
              await refreshReminders()
              schedulePushUpdate()
              showToast('Jadwal dihapus; transaksi yang sudah tercatat tetap ada')
              navigate('/lainnya/rutin', { replace: true })
            }}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-expense/30 font-semibold text-expense"
          />
        )}
      </main>
    </>
  )
}
