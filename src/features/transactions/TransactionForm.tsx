import { ArrowDownUp, CalendarDays, ChevronDown, Clock, CopyPlus, NotebookPen, Repeat, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { AmountKeypad } from '../../components/AmountKeypad'
import { IconBadge } from '../../components/IconBadge'
import { showToast } from '../../components/toast'
import { useBalances, useCategoriesByUsage } from '../../db/hooks'
import {
  deleteTransaction,
  duplicateTransaction,
  restoreTransactions,
  saveTransaction,
  ValidationError,
  type TransactionDraft,
} from '../../db/transactions'
import type { Category, Transaction, Wallet } from '../../db/types'
import { formatDayShort, formatRelativeDay, toTimeKey, todayKey } from '../../lib/dates'
import { addCapped, formatNumber, formatRupiah, parseAmountInput } from '../../lib/money'
import { NOTE_MAX } from '../../lib/validation'
import { announceBudgetAlerts } from '../budgets/announce'
import type { AddKind } from './addSheetParam'

type Props = {
  initialKind: AddKind
  existing?: Transaction
  /** Fee expense linked to an existing transfer. */
  existingFee?: Transaction
  wallets: Wallet[]
  defaultWalletId: string
  /** Prefilled transfer destination, e.g. paying a credit card. */
  defaultToWalletId?: string
  onDone: () => void
}

const QUICK_ADD = [10_000, 50_000, 100_000]
const QUICK_ADD_TRANSFER = [100_000, 250_000, 500_000, 1_000_000]

const TABS: { kind: AddKind; label: string }[] = [
  { kind: 'expense', label: 'Pengeluaran' },
  { kind: 'income', label: 'Pemasukan' },
  { kind: 'transfer', label: 'Transfer' },
]

export function TransactionForm({ initialKind, existing, existingFee, wallets, defaultWalletId, defaultToWalletId, onDone }: Props) {
  const [now] = useState(() => new Date())
  const [kind, setKind] = useState<AddKind>(existing ? (existing.type === 'refund' ? 'income' : (existing.type as AddKind)) : initialKind)
  const [isRefund, setIsRefund] = useState(existing?.type === 'refund')
  const [amount, setAmount] = useState(existing?.amount ?? 0)
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId)
  const [toWalletId, setToWalletId] = useState<string | undefined>(
    existing?.toWalletId ?? defaultToWalletId ?? wallets.find((w) => !w.archived && w.id !== (existing?.walletId ?? defaultWalletId))?.id,
  )
  // Never default the source to the prefilled destination.
  const [walletId, setWalletId] = useState(
    existing?.walletId ??
      (defaultWalletId !== toWalletId ? defaultWalletId : (wallets.find((w) => !w.archived && w.id !== toWalletId && w.type !== 'credit')?.id ?? defaultWalletId)),
  )
  const [date, setDate] = useState(existing?.date ?? todayKey(now))
  const [time, setTime] = useState(existing?.time ?? toTimeKey(now))
  const [note, setNote] = useState(existing?.note ?? '')
  const [adminFee, setAdminFee] = useState(existingFee?.amount ?? 0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)

  // Refunds pick the original expense category (FR-1.9).
  const categoryKind = kind === 'expense' || isRefund ? 'expense' : 'income'
  const categories = useCategoriesByUsage(categoryKind)
  const balances = useBalances()

  const type: TransactionDraft['type'] = kind === 'income' && isRefund ? 'refund' : kind
  const isTransfer = kind === 'transfer'
  const selectable = wallets.filter((w) => !w.archived || w.id === walletId || w.id === toWalletId)
  const accent = kind === 'expense' ? 'expense' : 'primary'

  const switchKind = (next: AddKind) => {
    setKind(next)
    setIsRefund(false)
    setCategoryId(undefined)
    setError(null)
  }

  const toggleRefund = () => {
    setIsRefund((r) => !r)
    setCategoryId(undefined)
  }

  // Yellow warning before a non-credit wallet goes negative (FR-3.9).
  const negativeWarning = useMemo(() => {
    if (!balances || !(type === 'expense' || type === 'transfer')) return null
    const wallet = wallets.find((w) => w.id === walletId)
    if (!wallet || wallet.type === 'credit') return null
    let balance = balances.balances.get(walletId) ?? 0
    // Editing: undo the original transaction's effect on this wallet first.
    if (existing && existing.walletId === walletId && (existing.type === 'expense' || existing.type === 'transfer'))
      balance += existing.amount + (existingFee?.amount ?? 0)
    const after = balance - amount - (isTransfer ? adminFee : 0)
    return after < 0 && amount > 0 ? `Saldo ${wallet.name} akan menjadi ${formatRupiah(after)}` : null
  }, [balances, type, wallets, walletId, existing, existingFee, amount, isTransfer, adminFee])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const { alerts } = await saveTransaction(
        { type, amount, categoryId, walletId, toWalletId, date, time, note, adminFee: isTransfer ? adminFee : undefined },
        existing?.id,
      )
      onDone()
      showToast(existing ? 'Perubahan disimpan' : 'Tersimpan')
      announceBudgetAlerts(alerts)
    } catch (e) {
      if (e instanceof ValidationError) setError(e.message)
      else throw e
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!existing) return
    const removed = await deleteTransaction(existing.id)
    onDone()
    showToast('Transaksi dihapus', { duration: 5000, action: { label: 'Urungkan', onClick: () => void restoreTransactions(removed) } })
  }

  const duplicate = async () => {
    if (!existing) return
    const result = await duplicateTransaction(existing.id)
    onDone()
    showToast('Diduplikat ke hari ini')
    if (result) announceBudgetAlerts(result.alerts)
  }

  const visibleCategories = showAllCategories ? categories : categories?.slice(0, 7)

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Jenis transaksi" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
        {TABS.map(({ kind: k, label }) => {
          const selected = k === kind
          const selectedColor = k === 'expense' ? 'bg-expense text-on-expense' : 'bg-primary text-on-primary'
          return (
            <button
              key={k}
              type="button"
              aria-pressed={selected}
              onClick={() => switchKind(k)}
              className={`min-h-11 rounded-xl text-sm font-semibold ${selected ? selectedColor : 'text-text-muted'}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {existing?.recurringId && (
        <p className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-xs">
          <Repeat className="size-4 text-primary" aria-hidden="true" /> Dibuat dari transaksi rutin
        </p>
      )}

      <section className="rounded-3xl bg-surface-muted px-4 py-4 text-center">
        <p className={`text-xs font-semibold tracking-[0.12em] uppercase ${accent === 'expense' ? 'text-expense' : 'text-primary'}`}>
          Nominal {isRefund ? 'refund' : TABS.find((t) => t.kind === kind)?.label.toLowerCase()}
        </p>
        <p className="mt-1 flex items-baseline justify-center gap-2" aria-live="polite">
          <span className={`text-xl font-semibold ${accent === 'expense' ? 'text-expense' : 'text-primary'}`}>Rp</span>
          <span className="text-4xl font-bold tabular-nums">{formatNumber(amount)}</span>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {(isTransfer ? QUICK_ADD_TRANSFER : QUICK_ADD).map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => setAmount((a) => addCapped(a, delta))}
              className="min-h-9 rounded-full bg-surface px-3 text-sm font-medium"
            >
              +{delta >= 1_000_000 ? `${delta / 1_000_000}jt` : `${delta / 1000}rb`}
            </button>
          ))}
          {amount > 0 && (
            <button type="button" onClick={() => setAmount(0)} aria-label="Reset nominal" className="grid size-9 place-items-center rounded-full bg-surface">
              <Undo2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {kind === 'income' && (
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 text-sm">
          <span>
            <span className="font-semibold">Uang kembali (refund)</span>
            <span className="block text-xs text-text-muted">Mengurangi pengeluaran kategori asal, bukan pemasukan</span>
          </span>
          <input type="checkbox" checked={isRefund} onChange={toggleRefund} className="size-5 accent-primary" />
        </label>
      )}

      {isTransfer ? (
        <section className="space-y-2 rounded-3xl bg-surface-muted p-3">
          <WalletSelect label="Dari dompet" value={walletId} onChange={setWalletId} wallets={selectable} balances={balances?.balances} />
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Tukar dompet asal dan tujuan"
              onClick={() => {
                if (!toWalletId) return
                setWalletId(toWalletId)
                setToWalletId(walletId)
              }}
              className="grid size-10 place-items-center rounded-full bg-primary text-on-primary"
            >
              <ArrowDownUp className="size-5" aria-hidden="true" />
            </button>
          </div>
          <WalletSelect label="Ke dompet" value={toWalletId ?? ''} onChange={setToWalletId} wallets={selectable} balances={balances?.balances} />
          <label className="flex min-h-11 items-center justify-between gap-3 px-2 text-sm">
            <span className="text-text-muted">Biaya admin (opsional)</span>
            <input
              inputMode="numeric"
              value={adminFee ? formatNumber(adminFee) : ''}
              onChange={(e) => setAdminFee(parseAmountInput(e.target.value))}
              placeholder="Rp 0"
              className="w-32 rounded-xl bg-surface px-3 py-2 text-right"
            />
          </label>
        </section>
      ) : (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold">Pilih Kategori</h3>
            <span className={`text-sm font-semibold ${accent === 'expense' ? 'text-expense' : 'text-primary'}`}>
              {categories?.find((c) => c.id === categoryId)?.name}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {visibleCategories?.map((c) => (
              <CategoryTile key={c.id} category={c} selected={c.id === categoryId} onSelect={() => setCategoryId(c.id)} />
            ))}
            {!showAllCategories && categories && categories.length > 7 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(true)}
                className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl bg-surface-muted p-2 text-xs"
              >
                <ChevronDown className="size-5" aria-hidden="true" />
                Semua
              </button>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!isTransfer && (
          <div className="col-span-2">
            <WalletSelect label="Sumber dana" value={walletId} onChange={setWalletId} wallets={selectable} balances={balances?.balances} />
          </div>
        )}
        <PickerChip icon={<CalendarDays className="size-5 text-primary" aria-hidden="true" />} label="Tanggal" text={date === todayKey() ? `Hari ini, ${formatDayShort(date)}` : formatRelativeDay(date)}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tanggal" className="absolute inset-0 opacity-0" />
        </PickerChip>
        <PickerChip icon={<Clock className="size-5 text-primary" aria-hidden="true" />} label="Jam" text={time}>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Jam" className="absolute inset-0 opacity-0" />
        </PickerChip>
      </div>

      <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-muted px-4">
        <NotebookPen className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
        <span className="sr-only">Catatan</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          placeholder="Catatan (opsional)"
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-text-muted"
        />
      </label>

      {negativeWarning && (
        <p className="flex items-center gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden="true" /> {negativeWarning}
        </p>
      )}

      <AmountKeypad value={amount} onChange={setAmount} />

      {error && (
        <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-sm font-medium text-expense">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`flex min-h-14 w-full items-center justify-between rounded-2xl px-5 text-lg font-semibold shadow-lg disabled:opacity-60 ${
          accent === 'expense' ? 'bg-expense text-on-expense' : 'bg-primary text-on-primary'
        }`}
      >
        <span>{existing ? 'Simpan Perubahan' : isTransfer ? 'Transfer Sekarang' : 'Simpan Transaksi'}</span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-base tabular-nums">{formatRupiah(amount)}</span>
      </button>

      {existing && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={duplicate} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface-muted font-semibold">
            <CopyPlus className="size-5" aria-hidden="true" /> Duplikat
          </button>
          <button type="button" onClick={remove} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-expense-soft font-semibold text-expense">
            <Trash2 className="size-5" aria-hidden="true" /> Hapus
          </button>
        </div>
      )}
    </div>
  )
}

function CategoryTile({ category, selected, onSelect }: { category: Category; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl p-2 text-xs ${
        selected ? 'bg-surface font-semibold ring-2 ring-primary' : 'bg-surface-muted'
      }`}
    >
      <IconBadge icon={category.icon} color={category.color} solid={selected} size="sm" />
      <span className="line-clamp-2 leading-tight">{category.name}</span>
    </button>
  )
}

function PickerChip({ icon, label, text, children }: { icon: ReactNode; label: string; text: string; children: ReactNode }) {
  return (
    // The native input covers the chip so a tap opens the OS picker directly.
    <div className="relative flex min-h-14 items-center gap-3 rounded-2xl bg-surface-muted px-4">
      {icon}
      <span className="min-w-0">
        <span className="block text-[11px] text-text-muted">{label}</span>
        <span className="block truncate text-sm font-semibold">{text}</span>
      </span>
      {children}
    </div>
  )
}

function WalletSelect({
  label,
  value,
  onChange,
  wallets,
  balances,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  wallets: Wallet[]
  balances?: Map<string, number>
}) {
  const wallet = wallets.find((w) => w.id === value)
  return (
    <label className="relative flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4">
      {wallet ? <IconBadge icon={wallet.icon} color={wallet.color} size="sm" /> : <span className="size-9" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-text-muted">{label}</span>
        <span className="block truncate text-sm font-semibold">
          {wallet ? `${wallet.name} · ${formatRupiah(balances?.get(wallet.id) ?? 0)}` : 'Pilih dompet'}
        </span>
      </span>
      <ChevronDown className="size-5 text-text-muted" aria-hidden="true" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 opacity-0">
        {!wallet && <option value="">Pilih dompet</option>}
        {wallets.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  )
}
