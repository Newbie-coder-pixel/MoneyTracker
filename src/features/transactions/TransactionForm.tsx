import { ArrowDownUp, Check, CopyPlus, Pencil, Repeat, Trash2, TriangleAlert, Undo2, X } from 'lucide-react'
import { createElement, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
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
import type { Transaction, Wallet } from '../../db/types'
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

type ActiveField = 'amount' | 'category' | 'wallet' | 'toWallet'

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
  // Which line's picker is open. A new entry starts at the amount; an edit starts closed.
  const [active, setActive] = useState<ActiveField | null>(existing ? null : 'amount')
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
    // The other pickers don't exist for every kind (no category on a transfer).
    setActive((a) => (a === 'amount' ? a : null))
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

  const fromWallet = wallets.find((w) => w.id === walletId)
  const toWallet = wallets.find((w) => w.id === toWalletId)
  const pickCategory = (id: string) => {
    setCategoryId(id)
    setActive(null)
  }
  // "Lanjut" under the keypad moves to the next thing still missing.
  const afterAmount = () => setActive(isTransfer ? (toWalletId ? null : 'toWallet') : categoryId ? null : 'category')

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

      {/* The form is a short ledger: one line per field. Only the line being filled in
          opens its picker below, so the sheet never shows everything at once. */}
      <div>
        <FieldRow label="Nominal" active={active === 'amount'} onClick={() => setActive('amount')}>
          <span className={`text-2xl font-bold tracking-tight ${AMOUNT_INK[isRefund ? 'income' : kind]}`} aria-live="polite">
            <span className="text-lg">Rp</span> {formatNumber(amount)}
          </span>
        </FieldRow>

        {isTransfer ? (
          <>
            <FieldRow label="Dari" active={active === 'wallet'} onClick={() => setActive('wallet')}>
              <WalletValue wallet={fromWallet} balance={balances?.balances.get(walletId)} />
            </FieldRow>
            <FieldRow
              label="Ke"
              active={active === 'toWallet'}
              onClick={() => setActive('toWallet')}
              aside={
                <button
                  type="button"
                  aria-label="Tukar dompet asal dan tujuan"
                  onClick={() => {
                    if (!toWalletId) return
                    setWalletId(toWalletId)
                    setToWalletId(walletId)
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-text-muted active:bg-surface-muted"
                >
                  <ArrowDownUp className="size-4" aria-hidden="true" />
                </button>
              }
            >
              <WalletValue wallet={toWallet} balance={toWalletId ? balances?.balances.get(toWalletId) : undefined} />
            </FieldRow>
            <label className={ROW}>
              <span className={ROW_LABEL}>Biaya admin</span>
              <input
                inputMode="numeric"
                value={adminFee ? formatNumber(adminFee) : ''}
                onChange={(e) => setAdminFee(parseAmountInput(e.target.value))}
                onFocus={() => setActive(null)}
                placeholder="Opsional"
                className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-semibold outline-none placeholder:font-normal"
              />
            </label>
          </>
        ) : (
          <>
            <FieldRow label="Kategori" active={active === 'category'} onClick={() => setActive('category')}>
              {selectedCategory ? (
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <span style={{ color: selectedCategory.color }} aria-hidden="true">
                    {createElement(iconFor(selectedCategory.icon), { className: 'size-4', strokeWidth: 1.75 })}
                  </span>
                  <span className="truncate">{selectedCategory.name}</span>
                </span>
              ) : (
                <span className="text-[15px] text-text-muted">Pilih kategori</span>
              )}
            </FieldRow>
            {needsNewCategory && (
              <label className="block border-b border-border py-3">
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
            <FieldRow label="Dompet" active={active === 'wallet'} onClick={() => setActive('wallet')}>
              <WalletValue wallet={fromWallet} balance={balances?.balances.get(walletId)} />
            </FieldRow>
          </>
        )}

        <div className={ROW}>
          <span className={ROW_LABEL}>Waktu</span>
          {/* The native inputs cover their text so a tap opens the OS picker directly. */}
          <span className="relative flex min-h-12 flex-1 items-center text-[15px] font-semibold">
            {date === todayKey() ? `Hari ini, ${formatDayShort(date)}` : formatRelativeDay(date)}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onFocus={() => setActive(null)}
              aria-label="Tanggal"
              className="absolute inset-0 opacity-0"
            />
          </span>
          <span className="relative flex min-h-12 w-16 items-center justify-end text-[15px] font-semibold">
            {time}
            <input
              type="time"
              value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
              onFocus={() => setActive(null)}
              aria-label="Jam"
              className="absolute inset-0 opacity-0"
            />
          </span>
        </div>

        <label className={ROW}>
          <span className={ROW_LABEL}>Catatan</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onFocus={() => setActive(null)}
            maxLength={NOTE_MAX}
            placeholder="Opsional"
            className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none"
          />
        </label>

        {kind === 'income' && (
          <label className={`${ROW} py-2`}>
            <span className="flex-1 text-sm">
              <span className="font-semibold">Uang kembali (refund)</span>
              <span className="block text-xs text-text-muted">Mengurangi pengeluaran kategori asal, bukan pemasukan</span>
            </span>
            <input type="checkbox" checked={isRefund} onChange={toggleRefund} className="size-5 accent-primary" />
          </label>
        )}
      </div>

      {negativeWarning && (
        <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] text-warning">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> {negativeWarning}
        </p>
      )}

      {active === 'amount' && (
        <Panel title="Nominal" onClose={() => setActive(null)}>
          <div className="mb-2 flex flex-wrap gap-2">
            {(isTransfer ? QUICK_ADD_TRANSFER : QUICK_ADD).map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setAmount((a) => addCapped(a, delta))}
                className="min-h-9 rounded-full border border-border bg-surface px-3 text-[13px] font-medium active:bg-surface-muted"
              >
                +{delta >= 1_000_000 ? `${delta / 1_000_000}jt` : `${delta / 1000}rb`}
              </button>
            ))}
            {amount > 0 && (
              <button type="button" onClick={() => setAmount(0)} aria-label="Reset nominal" className="grid size-9 place-items-center rounded-full border border-border bg-surface text-text-muted">
                <Undo2 className="size-4" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={afterAmount} disabled={amount <= 0} className="ml-auto min-h-9 rounded-full bg-primary px-4 text-[13px] font-semibold text-on-primary disabled:opacity-40">
              Lanjut
            </button>
          </div>
          <AmountKeypad value={amount} onChange={setAmount} />
        </Panel>
      )}

      {active === 'category' && (
        <Panel
          title="Kategori"
          onClose={() => setActive(null)}
          action={
            <Link to="/lainnya/kategori" aria-label="Kelola kategori" className="grid size-11 place-items-center rounded-full text-text-muted">
              <Pencil className="size-4" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {categories?.map((c) => {
              const selected = c.id === categoryId
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickCategory(c.id)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs leading-tight ${
                    selected ? 'bg-primary font-semibold text-on-primary' : 'bg-surface active:bg-surface-muted'
                  }`}
                >
                  <span style={selected ? undefined : { color: c.color }} aria-hidden="true">
                    {createElement(iconFor(c.icon), { className: 'size-5', strokeWidth: 1.75 })}
                  </span>
                  <span className="line-clamp-2">{c.name}</span>
                </button>
              )
            })}
            {/* Blank cells keep the last row's hairlines complete. */}
            {Array.from({ length: (3 - ((categories?.length ?? 0) % 3)) % 3 }, (_, i) => (
              <span key={i} className="bg-surface" aria-hidden="true" />
            ))}
          </div>
        </Panel>
      )}

      {(active === 'wallet' || active === 'toWallet') && (
        <Panel title={active === 'toWallet' ? 'Ke dompet' : isTransfer ? 'Dari dompet' : 'Dompet'} onClose={() => setActive(null)}>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {selectable.map((w) => {
              const selected = w.id === (active === 'toWallet' ? toWalletId : walletId)
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (active === 'toWallet') setToWalletId(w.id)
                    else setWalletId(w.id)
                    setActive(null)
                  }}
                  className={`min-h-14 px-3 py-2 text-left ${selected ? 'bg-primary text-on-primary' : 'bg-surface active:bg-surface-muted'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: w.color }} aria-hidden="true" />
                    <span className="truncate">{w.name}</span>
                  </span>
                  <span className={`block text-xs ${selected ? 'opacity-80' : 'text-text-muted'}`}>{formatRupiah(balances?.balances.get(w.id) ?? 0)}</span>
                </button>
              )
            })}
            {selectable.length % 2 === 1 && <span className="bg-surface" aria-hidden="true" />}
          </div>
        </Panel>
      )}

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

const ROW = 'flex min-h-12 items-center gap-3 border-b border-border'
const ROW_LABEL = 'w-20 shrink-0 text-[13px] text-text-muted'

/** One ledger line that opens a picker; the line being filled in gets an ink underline. */
function FieldRow({ label, active, onClick, aside, children }: { label: string; active: boolean; onClick: () => void; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className={`flex items-center border-b ${active ? 'border-text' : 'border-border'}`}>
      <button type="button" aria-expanded={active} onClick={onClick} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-1.5 text-left">
        <span className={ROW_LABEL}>{label}</span>
        <span className="min-w-0 flex-1">{children}</span>
      </button>
      {aside}
    </div>
  )
}

function WalletValue({ wallet, balance }: { wallet?: Wallet; balance?: number }) {
  if (!wallet) return <span className="text-[15px] text-text-muted">Pilih dompet</span>
  return (
    <span className="flex items-center gap-2 text-[15px] font-semibold">
      <span className="size-2 shrink-0 rounded-full" style={{ background: wallet.color }} aria-hidden="true" />
      <span className="truncate">{wallet.name}</span>
      <span className="shrink-0 text-[13px] font-normal text-text-muted">{formatRupiah(balance ?? 0)}</span>
    </span>
  )
}

/** The picker for the active line: a titled tray, like the keyboard area of the sheet. */
function Panel({ title, onClose, action, children }: { title: string; onClose: () => void; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="-mx-5 border-y border-border bg-surface-muted px-5 pt-1 pb-4">
      <div className="flex min-h-11 items-center">
        <h3 className="label-caps flex-1">{title}</h3>
        {action}
        <button type="button" onClick={onClose} aria-label={`Tutup ${title.toLowerCase()}`} className="-mr-3 grid size-11 place-items-center rounded-full text-text-muted">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  )
}
