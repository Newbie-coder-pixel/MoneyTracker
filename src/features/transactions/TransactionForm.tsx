import { ArrowDownUp, ArrowRight, Check, ChevronDown, ChevronLeft, CopyPlus, Repeat, Trash2, TriangleAlert, Undo2, X } from 'lucide-react'
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

type Step = 'category' | 'amount' | 'details'

/** A transfer has no category, so it starts at the amount. */
const stepsFor = (kind: AddKind): Step[] => (kind === 'transfer' ? ['amount', 'details'] : ['category', 'amount', 'details'])

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
  // A new entry walks through the steps; an edit opens on the summary.
  const [step, setStep] = useState<Step>(existing ? 'details' : stepsFor(initialKind)[0])
  const [reviewed, setReviewed] = useState(!!existing)
  const [kindOpen, setKindOpen] = useState(false)
  const [openList, setOpenList] = useState<'wallet' | 'toWallet' | null>(null)
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
    setKindOpen(false)
    setOpenList(null)
    // A new entry restarts at the first step of that kind; an edit stays on its summary.
    if (!existing) {
      setReviewed(false)
      setStep(stepsFor(next)[0])
    }
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
  const steps = stepsFor(kind)
  const stepIndex = steps.indexOf(step)
  // Once the summary has been seen, a correction goes straight back to it.
  const advance = () => setStep(reviewed ? 'details' : (steps[stepIndex + 1] ?? 'details'))
  const openDetails = () => {
    setReviewed(true)
    setStep('details')
  }
  const pickCategory = (id: string) => {
    setCategoryId(id)
    const picked = categories?.find((c) => c.id === id)
    // "Lainnya" stays on this step until the new category has a name.
    if (picked && !isRefund && isOtherCategory(picked) && existing?.categoryId !== id) return
    if (reviewed) setStep('details')
    else setStep('amount')
  }
  const kindLabel = TABS.find((t) => t.kind === kind)?.label ?? ''

  return (
    <div className="space-y-4">
      {/* One step per screen: category, then amount, then the rest. Nothing else is shown
          while a step is open, so the sheet never looks crowded. */}
      <div className="flex items-center gap-1">
        {stepIndex > 0 && (
          <button type="button" onClick={() => setStep(steps[stepIndex - 1])} aria-label="Langkah sebelumnya" className="-ml-3 grid size-11 shrink-0 place-items-center rounded-full">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          aria-expanded={kindOpen}
          aria-label={`Jenis transaksi: ${kindLabel}`}
          onClick={() => setKindOpen(!kindOpen)}
          className="flex min-h-11 min-w-0 items-center gap-1.5 text-lg font-bold tracking-tight"
        >
          <span className="truncate">{kindLabel}</span>
          <ChevronDown className={`size-4 shrink-0 text-text-muted ${kindOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <span className="flex-1" />
        <button type="button" onClick={onDone} aria-label="Tutup" className="grid size-11 shrink-0 place-items-center rounded-full border border-border active:bg-surface-muted">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {kindOpen ? (
        <ul className="overflow-hidden rounded-xl border border-border">
          {TABS.map(({ kind: k, label }) => (
            <li key={k} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => switchKind(k)} className="flex min-h-12 w-full items-center justify-between px-4 text-left text-[15px] active:bg-surface-muted">
                <span className={k === kind ? 'font-semibold' : ''}>{label}</span>
                {k === kind && <Check className="size-4" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div>
            <p className="label-caps">
              Langkah {stepIndex + 1} dari {steps.length}
            </p>
            <div className="mt-1.5 flex gap-1.5" aria-hidden="true">
              {steps.map((st, n) => (
                <span key={st} className={`h-1 flex-1 rounded-full ${n <= stepIndex ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </div>

          {step === 'category' && (
            <>
              <h3 className="text-xl font-bold tracking-tight">{isRefund ? 'Refund dari kategori apa?' : 'Pilih kategori'}</h3>
              {kind === 'income' && (
                <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 py-2 text-sm">
                  <span>
                    <span className="font-semibold">Uang kembali (refund)</span>
                    <span className="block text-xs text-text-muted">Mengurangi pengeluaran kategori asal, bukan pemasukan</span>
                  </span>
                  <input type="checkbox" checked={isRefund} onChange={toggleRefund} className="size-5 accent-primary" />
                </label>
              )}
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
                {categories?.map((c) => {
                  const selected = c.id === categoryId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickCategory(c.id)}
                      className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 px-1 py-2 text-center text-xs leading-tight ${
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
                {Array.from({ length: (3 - ((categories?.length ?? 0) % 3)) % 3 }, (_, n) => (
                  <span key={n} className="bg-surface" aria-hidden="true" />
                ))}
              </div>
              {needsNewCategory && (
                <>
                  <label className="block">
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
                  <button type="button" onClick={advance} disabled={!newCategoryName.trim()} className={PRIMARY}>
                    Lanjut <ArrowRight className="size-5" aria-hidden="true" />
                  </button>
                </>
              )}
            </>
          )}

          {step === 'amount' && (
            <>
              <div className="py-2 text-center">
                <h3 className="label-caps">
                  {isTransfer ? 'Nominal transfer' : selectedCategory ? selectedCategory.name : `Nominal ${kindLabel.toLowerCase()}`}
                </h3>
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
              </div>
              <AmountKeypad value={amount} onChange={setAmount} />
              <button type="button" onClick={openDetails} disabled={amount <= 0} className={PRIMARY}>
                Lanjut <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </>
          )}

          {step === 'details' && (
            <>
              {existing?.recurringId && (
                <p className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
                  <Repeat className="size-4" aria-hidden="true" /> Dibuat dari transaksi rutin
                </p>
              )}
              <div className="border-t border-border">
                <SummaryRow label="Nominal" onClick={() => setStep('amount')}>
                  <span className={`text-xl font-bold tracking-tight ${AMOUNT_INK[isRefund ? 'income' : kind]}`}>{formatRupiah(amount)}</span>
                </SummaryRow>
                {isTransfer ? (
                  <>
                    <WalletDropdown
                      label="Dari"
                      wallet={fromWallet}
                      wallets={selectable}
                      balances={balances?.balances}
                      open={openList === 'wallet'}
                      onToggle={() => setOpenList(openList === 'wallet' ? null : 'wallet')}
                      onPick={(id) => {
                        setWalletId(id)
                        setOpenList(null)
                      }}
                    />
                    <WalletDropdown
                      label="Ke"
                      wallet={toWallet}
                      wallets={selectable}
                      balances={balances?.balances}
                      open={openList === 'toWallet'}
                      onToggle={() => setOpenList(openList === 'toWallet' ? null : 'toWallet')}
                      onPick={(id) => {
                        setToWalletId(id)
                        setOpenList(null)
                      }}
                    />
                    <div className={ROW}>
                      <span className={ROW_LABEL}>Biaya admin</span>
                      <input
                        inputMode="numeric"
                        value={adminFee ? formatNumber(adminFee) : ''}
                        onChange={(e) => setAdminFee(parseAmountInput(e.target.value))}
                        aria-label="Biaya admin"
                        placeholder="Opsional"
                        className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-semibold outline-none placeholder:font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!toWalletId) return
                          setWalletId(toWalletId)
                          setToWalletId(walletId)
                        }}
                        className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-semibold text-accent"
                      >
                        <ArrowDownUp className="size-4" aria-hidden="true" /> Tukar dompet
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <SummaryRow label="Kategori" onClick={() => setStep('category')}>
                      {selectedCategory ? (
                        <span className="flex items-center gap-2 text-[15px] font-semibold">
                          <span style={{ color: selectedCategory.color }} aria-hidden="true">
                            {createElement(iconFor(selectedCategory.icon), { className: 'size-4', strokeWidth: 1.75 })}
                          </span>
                          <span className="truncate">{needsNewCategory && newCategoryName.trim() ? newCategoryName.trim() : selectedCategory.name}</span>
                        </span>
                      ) : (
                        <span className="text-[15px] text-text-muted">Pilih kategori</span>
                      )}
                    </SummaryRow>
                    <WalletDropdown
                      label="Dompet"
                      wallet={fromWallet}
                      wallets={selectable}
                      balances={balances?.balances}
                      open={openList === 'wallet'}
                      onToggle={() => setOpenList(openList === 'wallet' ? null : 'wallet')}
                      onPick={(id) => {
                        setWalletId(id)
                        setOpenList(null)
                      }}
                    />
                  </>
                )}

                <div className={ROW}>
                  <span className={ROW_LABEL}>Waktu</span>
                  {/* The native inputs cover their text so a tap opens the OS picker directly. */}
                  <span className="relative flex min-h-12 flex-1 items-center text-[15px] font-semibold">
                    {date === todayKey() ? `Hari ini, ${formatDayShort(date)}` : formatRelativeDay(date)}
                    <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Tanggal" className="absolute inset-0 opacity-0" />
                  </span>
                  <span className="relative flex min-h-12 w-16 items-center justify-end text-[15px] font-semibold">
                    {time}
                    <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label="Jam" className="absolute inset-0 opacity-0" />
                  </span>
                </div>

                <label className={ROW}>
                  <span className={ROW_LABEL}>Catatan</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={NOTE_MAX}
                    placeholder="Opsional"
                    className="min-w-0 flex-1 bg-transparent py-3 text-[15px] outline-none"
                  />
                </label>
              </div>

              {negativeWarning && (
                <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] text-warning">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden="true" /> {negativeWarning}
                </p>
              )}

              {error && (
                <p role="alert" className="rounded-xl border border-expense/30 bg-expense-soft px-4 py-3 text-sm font-medium text-expense">
                  {error}
                </p>
              )}

              <button type="button" onClick={save} disabled={saving} className={PRIMARY}>
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
            </>
          )}
        </>
      )}
    </div>
  )
}

const PRIMARY =
  'flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-on-primary active:opacity-90 disabled:opacity-40'
const ROW = 'flex min-h-12 items-center gap-3 border-b border-border'
const ROW_LABEL = 'w-20 shrink-0 text-[13px] text-text-muted'

/** A filled-in line on the last step; tapping it goes back to that step to change it. */
function SummaryRow({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`${ROW} w-full py-1.5 text-left`}>
      <span className={ROW_LABEL}>{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
      <span className="text-[13px] font-semibold text-accent">Ubah</span>
    </button>
  )
}

/** A line that drops its list open underneath, so wallets only take space while choosing. */
function WalletDropdown({
  label,
  wallet,
  wallets,
  balances,
  open,
  onToggle,
  onPick,
}: {
  label: string
  wallet?: Wallet
  wallets: Wallet[]
  balances?: Map<string, number>
  open: boolean
  onToggle: () => void
  onPick: (id: string) => void
}) {
  return (
    <div className="border-b border-border">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-12 w-full items-center gap-3 py-1.5 text-left">
        <span className={ROW_LABEL}>{label}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold">
          {wallet ? (
            <>
              <span className="size-2 shrink-0 rounded-full" style={{ background: wallet.color }} aria-hidden="true" />
              <span className="truncate">{wallet.name}</span>
              <span className="shrink-0 text-[13px] font-normal text-text-muted">{formatRupiah(balances?.get(wallet.id) ?? 0)}</span>
            </>
          ) : (
            <span className="font-normal text-text-muted">Pilih dompet</span>
          )}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-text-muted ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="mb-3 overflow-hidden rounded-xl border border-border bg-surface-muted">
          {wallets.map((w) => (
            <li key={w.id} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => onPick(w.id)} className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-[15px] active:bg-border">
                <span className="size-2 shrink-0 rounded-full" style={{ background: w.color }} aria-hidden="true" />
                <span className={`min-w-0 flex-1 truncate ${w.id === wallet?.id ? 'font-semibold' : ''}`}>{w.name}</span>
                <span className="shrink-0 text-[13px] text-text-muted">{formatRupiah(balances?.get(w.id) ?? 0)}</span>
                {w.id === wallet?.id && <Check className="size-4 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
