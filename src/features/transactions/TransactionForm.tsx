import { ArrowDownUp, CalendarDays, Check, ChevronDown, Clock, CopyPlus, NotebookPen, Repeat, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { createElement, useMemo, useState, type ReactNode } from 'react'
import { AmountKeypad } from '../../components/AmountKeypad'
import { iconFor } from '../../components/icons'
import { inputClass } from '../../components/Pickers'
import { showToast } from '../../components/toast'
import { deleteCategory, findOrCreateCategory, isOtherCategory } from '../../db/categories'
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

/** The amount is inked by direction: red out, forest in, plain ink for a transfer. */
const AMOUNT_INK: Record<AddKind, string> = { expense: 'text-expense', income: 'text-income', transfer: 'text-text' }

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
  const [newCategoryName, setNewCategoryName] = useState('')

  // Refunds pick the original expense category (FR-1.9).
  const categoryKind = kind === 'expense' || isRefund ? 'expense' : 'income'
  const categories = useCategoriesByUsage(categoryKind)
  const balances = useBalances()

  const type: TransactionDraft['type'] = kind === 'income' && isRefund ? 'refund' : kind
  const isTransfer = kind === 'transfer'
  const selectable = wallets.filter((w) => !w.archived || w.id === walletId || w.id === toWalletId)
  // Picking "Lainnya" requires naming a new category. Refunds are exempt (they point at an
  // existing expense category), and so is an edit that leaves an old "Lainnya" untouched.
  const selectedCategory = categories?.find((c) => c.id === categoryId)
  const needsNewCategory = !isRefund && !!selectedCategory && isOtherCategory(selectedCategory) && existing?.categoryId !== categoryId

  const switchKind = (next: AddKind) => {
    setKind(next)
    setIsRefund(false)
    setCategoryId(undefined)
    setNewCategoryName('')
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
    let finalCategoryId = categoryId
    let createdCategoryId: string | undefined
    try {
      if (needsNewCategory) {
        try {
          const result = await findOrCreateCategory(newCategoryName, categoryKind)
          finalCategoryId = result.id
          if (result.created) createdCategoryId = result.id
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Kategori baru gagal dibuat')
          return
        }
      }
      const { alerts } = await saveTransaction(
        { type, amount, categoryId: finalCategoryId, walletId, toWalletId, date, time, note, adminFee: isTransfer ? adminFee : undefined },
        existing?.id,
      )
      onDone()
      showToast(existing ? 'Perubahan disimpan' : 'Tersimpan')
      announceBudgetAlerts(alerts)
    } catch (e) {
      // Don't leave an unused category behind when the transaction itself was rejected.
      if (createdCategoryId) await deleteCategory(createdCategoryId).catch(() => {})
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
      <div role="group" aria-label="Jenis transaksi" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface-muted p-1">
        {TABS.map(({ kind: k, label }) => {
          const selected = k === kind
          return (
            <button
              key={k}
              type="button"
              aria-pressed={selected}
              onClick={() => switchKind(k)}
              className={`min-h-11 rounded-full text-sm ${selected ? 'bg-primary font-semibold text-on-primary' : 'font-medium text-text-muted'}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {existing?.recurringId && (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
          <Repeat className="size-4" aria-hidden="true" /> Dibuat dari transaksi rutin
        </p>
      )}

      <section className="pt-1 text-center">
        <p className="label-caps">Nominal {isRefund ? 'refund' : TABS.find((t) => t.kind === kind)?.label.toLowerCase()}</p>
        <p className={`mt-1 text-4xl leading-tight font-bold tracking-tight ${AMOUNT_INK[isRefund ? 'income' : kind]}`} aria-live="polite">
          <span className="text-[1.75rem]">Rp</span> {formatNumber(amount)}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {(isTransfer ? QUICK_ADD_TRANSFER : QUICK_ADD).map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={() => setAmount((a) => addCapped(a, delta))}
              className="min-h-9 rounded-full border border-border px-3 text-[13px] font-medium active:bg-surface-muted"
            >
              +{delta >= 1_000_000 ? `${delta / 1_000_000}jt` : `${delta / 1000}rb`}
            </button>
          ))}
          {amount > 0 && (
            <button type="button" onClick={() => setAmount(0)} aria-label="Reset nominal" className="grid size-9 place-items-center rounded-full border border-border text-text-muted">
              <Undo2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </section>

      {kind === 'income' && (
        <label className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border px-4 py-2 text-sm">
          <span>
            <span className="font-semibold">Uang kembali (refund)</span>
            <span className="block text-xs text-text-muted">Mengurangi pengeluaran kategori asal, bukan pemasukan</span>
          </span>
          <input type="checkbox" checked={isRefund} onChange={toggleRefund} className="size-5 accent-primary" />
        </label>
      )}

      {isTransfer ? (
        <section className="rounded-xl border border-border bg-surface-muted">
          <div className="relative divide-y divide-border">
            <WalletSelect label="Dari dompet" value={walletId} onChange={setWalletId} wallets={selectable} balances={balances?.balances} />
            <WalletSelect label="Ke dompet" value={toWalletId ?? ''} onChange={setToWalletId} wallets={selectable} balances={balances?.balances} />
            <button
              type="button"
              aria-label="Tukar dompet asal dan tujuan"
              onClick={() => {
                if (!toWalletId) return
                setWalletId(toWalletId)
                setToWalletId(walletId)
              }}
              className="absolute top-1/2 right-12 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface"
            >
              <ArrowDownUp className="size-4" aria-hidden="true" />
            </button>
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm">
            <span className="text-text-muted">Biaya admin (opsional)</span>
            <input
              inputMode="numeric"
              value={adminFee ? formatNumber(adminFee) : ''}
              onChange={(e) => setAdminFee(parseAmountInput(e.target.value))}
              placeholder="Rp 0"
              className="w-28 bg-transparent py-2 text-right font-semibold outline-none"
            />
          </label>
        </section>
      ) : (
        <section>
          <h3 className="label-caps mb-2">Kategori</h3>
          <div className="flex flex-wrap gap-2">
            {visibleCategories?.map((c) => (
              <CategoryChip key={c.id} category={c} selected={c.id === categoryId} onSelect={() => setCategoryId(c.id)} />
            ))}
            {!showAllCategories && categories && categories.length > 7 && (
              <button
                type="button"
                onClick={() => setShowAllCategories(true)}
                className="flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-3.5 text-[13px] font-medium text-text-muted"
              >
                Semua <ChevronDown className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
          {needsNewCategory && (
            <label className="mt-3 block">
              <span className="label-caps">Nama kategori baru</span>
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                maxLength={30}
                placeholder="Misal: Kopi"
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-text-muted">Wajib diisi. Kategori ini tersimpan dan bisa dipilih lagi nanti.</span>
            </label>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!isTransfer && (
          <div className="col-span-2 rounded-xl border border-border bg-surface-muted">
            <WalletSelect label="Dompet" value={walletId} onChange={setWalletId} wallets={selectable} balances={balances?.balances} />
          </div>
        )}
        <PickerChip icon={<CalendarDays className="size-4" aria-hidden="true" />} label="Tanggal" text={date === todayKey() ? `Hari ini, ${formatDayShort(date)}` : formatRelativeDay(date)}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tanggal" className="absolute inset-0 opacity-0" />
        </PickerChip>
        <PickerChip icon={<Clock className="size-4" aria-hidden="true" />} label="Jam" text={time}>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Jam" className="absolute inset-0 opacity-0" />
        </PickerChip>
      </div>

      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 focus-within:border-text">
        <NotebookPen className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        <span className="sr-only">Catatan</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={NOTE_MAX}
          placeholder="Catatan (opsional)"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
        />
      </label>

      {negativeWarning && (
        <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> {negativeWarning}
        </p>
      )}

      <AmountKeypad value={amount} onChange={setAmount} />

      {error && (
        <p role="alert" className="rounded-xl border border-expense/30 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-on-primary active:opacity-90 disabled:opacity-60"
      >
        <Check className="size-5" aria-hidden="true" />
        {existing ? 'Simpan perubahan' : isTransfer ? 'Transfer' : 'Simpan'}
      </button>

      {existing && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={duplicate} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border text-sm font-semibold active:bg-surface-muted">
            <CopyPlus className="size-4" aria-hidden="true" /> Duplikat
          </button>
          <button type="button" onClick={remove} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-expense/30 text-sm font-semibold text-expense active:bg-expense-soft">
            <Trash2 className="size-4" aria-hidden="true" /> Hapus
          </button>
        </div>
      )}
    </div>
  )
}

/** Category as a stamp-like pill; the selected one is filled with ink. */
function CategoryChip({ category, selected, onSelect }: { category: Category; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] ${
        selected ? 'border-primary bg-primary font-semibold text-on-primary' : 'border-border bg-surface font-medium'
      }`}
    >
      <span style={selected ? undefined : { color: category.color }} aria-hidden="true">
        {createElement(iconFor(category.icon), { className: 'size-4', strokeWidth: 1.75 })}
      </span>
      {category.name}
    </button>
  )
}

function PickerChip({ icon, label, text, children }: { icon: ReactNode; label: string; text: string; children: ReactNode }) {
  return (
    // The native input covers the chip so a tap opens the OS picker directly.
    <div className="relative flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 focus-within:border-text">
      <span className="min-w-0 flex-1">
        <span className="label-caps block">{label}</span>
        <span className="block truncate text-sm font-semibold">{text}</span>
      </span>
      <span className="text-text-muted">{icon}</span>
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
    <label className="relative flex min-h-14 items-center gap-3 px-4">
      <span className="min-w-0 flex-1">
        <span className="label-caps block">{label}</span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          {wallet && <span className="size-2 shrink-0 rounded-full" style={{ background: wallet.color }} aria-hidden="true" />}
          <span className="truncate">{wallet ? wallet.name : 'Pilih dompet'}</span>
          {wallet && <span className="shrink-0 font-normal text-text-muted">{formatRupiah(balances?.get(wallet.id) ?? 0)}</span>}
        </span>
      </span>
      <ChevronDown className="size-4 text-text-muted" aria-hidden="true" />
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
