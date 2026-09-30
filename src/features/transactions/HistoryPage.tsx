import { useLiveQuery } from 'dexie-react-hooks'
import { Download, ReceiptText, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'
import { Sheet } from '../../components/Sheet'
import { useCategories, useCategoryMap, useWalletMap, useWallets } from '../../db/hooks'
import { db } from '../../db/schema'
import { compareNewestFirst } from '../../db/transactions'
import type { TransactionType } from '../../db/types'
import { formatDayLong, formatDayShort, todayKey } from '../../lib/dates'
import { advancedFilterCount, filterFromParams, filterToParams, filterTransactions, groupByDay, type TxFilter } from '../../lib/filter'
import { formatNumber, formatRupiah, parseAmountInput } from '../../lib/money'
import { TransactionRow } from './TransactionRow'
import { useTransactionSheet } from './useTransactionSheet'

const PAGE_SIZE = 50

const TYPE_CHIPS: { value?: TransactionType; label: string; dot?: string }[] = [
  { label: 'Semua' },
  { value: 'expense', label: 'Pengeluaran', dot: 'bg-expense' },
  { value: 'income', label: 'Pemasukan', dot: 'bg-income' },
  { value: 'transfer', label: 'Transfer', dot: 'bg-primary' },
  { value: 'refund', label: 'Refund', dot: 'bg-income' },
]

export function HistoryPage() {
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => filterFromParams(params), [params])
  const categories = useCategoryMap()
  const wallets = useWalletMap()
  const sheet = useTransactionSheet()
  const [filterOpen, setFilterOpen] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [search, setSearch] = useState(filter.q ?? '')

  const all = useLiveQuery(() => db.transactions.toArray())
  const results = useMemo(() => {
    if (!all) return undefined
    return filterTransactions(all, filter, (id) => categories.get(id)?.name).sort(compareNewestFirst)
  }, [all, filter, categories])

  const applyFilter = (next: TxFilter) => {
    setParams(filterToParams(next, params), { replace: true })
    setVisible(PAGE_SIZE)
  }

  // Debounce typing into the URL.
  const searchTimer = useRef<number | undefined>(undefined)
  const onSearch = (value: string) => {
    setSearch(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => applyFilter({ ...filter, q: value || undefined }), 250)
  }

  // Infinite scroll: load the next 50 when the sentinel comes into view (FR-4.2).
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && setVisible((v) => v + PAGE_SIZE), { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [results])

  const groups = useMemo(() => groupByDay(results?.slice(0, visible) ?? []), [results, visible])
  const totals = useMemo(() => {
    let expense = 0
    let income = 0
    for (const tx of results ?? []) {
      if (tx.type === 'expense') expense += tx.amount
      else if (tx.type === 'refund') expense -= tx.amount
      else if (tx.type === 'income') income += tx.amount
    }
    return { expense: Math.max(0, expense), income }
  }, [results])

  const advanced = advancedFilterCount(filter)
  const exportParams = new URLSearchParams()
  if (filter.from) exportParams.set('from', filter.from)
  if (filter.to) exportParams.set('to', filter.to)
  const today = todayKey()

  return (
    <>
      <AppHeader
        title="Riwayat"
        actions={
          <Link to={`/lainnya/backup?${exportParams}`} aria-label="Export CSV" className="grid size-11 place-items-center rounded-full hover:bg-surface-muted">
            <Download className="size-6" aria-hidden="true" />
          </Link>
        }
      />
      <main className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-expense-soft p-3">
            <p className="text-xs text-text-muted">Pengeluaran</p>
            <p className="truncate font-bold text-expense tabular-nums">-{formatRupiah(totals.expense)}</p>
          </div>
          <div className="rounded-2xl bg-income-soft p-3">
            <p className="text-xs text-text-muted">Pemasukan</p>
            <p className="truncate font-bold text-income tabular-nums">+{formatRupiah(totals.income)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl bg-surface px-4">
            <Search className="size-5 text-text-muted" aria-hidden="true" />
            <span className="sr-only">Cari transaksi</span>
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Cari catatan atau kategori…"
              className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-text-muted"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label={advanced ? `Filter, ${advanced} aktif` : 'Filter'}
            className="relative grid size-12 place-items-center rounded-2xl bg-surface"
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" />
            {advanced > 0 && (
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-on-primary">
                {advanced}
              </span>
            )}
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {TYPE_CHIPS.map((chip) => {
            const active = filter.type === chip.value
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={active}
                onClick={() => applyFilter({ ...filter, type: chip.value })}
                className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ${active ? 'bg-primary text-on-primary' : 'bg-surface'}`}
              >
                {chip.dot && <span className={`size-2 rounded-full ${chip.dot}`} aria-hidden="true" />}
                {chip.label}
              </button>
            )
          })}
        </div>

        {advanced > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {filter.from || filter.to ? (
              <ActiveChip
                label={`${filter.from ? formatDayShort(filter.from) : '…'} – ${filter.to ? formatDayShort(filter.to) : '…'}`}
                onClear={() => applyFilter({ ...filter, from: undefined, to: undefined })}
              />
            ) : null}
            {filter.categoryId && (
              <ActiveChip label={categories.get(filter.categoryId)?.name ?? 'Kategori'} onClear={() => applyFilter({ ...filter, categoryId: undefined })} />
            )}
            {filter.walletId && <ActiveChip label={wallets.get(filter.walletId)?.name ?? 'Dompet'} onClear={() => applyFilter({ ...filter, walletId: undefined })} />}
            {(filter.min !== undefined || filter.max !== undefined) && (
              <ActiveChip
                label={`Rp ${filter.min !== undefined ? formatNumber(filter.min) : '0'} – ${filter.max !== undefined ? formatNumber(filter.max) : '∞'}`}
                onClear={() => applyFilter({ ...filter, min: undefined, max: undefined })}
              />
            )}
          </div>
        )}

        {results && results.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            message={all?.length ? 'Tidak ada transaksi yang cocok dengan filter.' : 'Belum ada transaksi. Ketuk + untuk mencatat yang pertama.'}
          />
        ) : (
          groups.map((group) => (
            <section key={group.date}>
              <h2 className="flex items-baseline justify-between px-1 pt-2 pb-2">
                <span className="font-semibold">
                  {group.date === today ? 'Hari ini · ' : ''}
                  {formatDayLong(group.date)}
                </span>
                <span className="flex gap-2 text-sm font-semibold tabular-nums">
                  {group.expense > 0 && <span className="text-expense">-{formatRupiah(group.expense)}</span>}
                  {group.income > 0 && <span className="text-income">+{formatRupiah(group.income)}</span>}
                </span>
              </h2>
              <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-surface">
                {group.txs.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} categories={categories} wallets={wallets} onOpen={sheet.openEdit} />
                ))}
              </ul>
            </section>
          ))
        )}
        {results && visible < results.length && <div ref={sentinel} className="h-10" aria-hidden="true" />}
      </main>

      <FilterSheet open={filterOpen} filter={filter} onClose={() => setFilterOpen(false)} onApply={applyFilter} />
    </>
  )
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex min-h-9 items-center gap-1 rounded-full bg-primary-soft pr-1 pl-3">
      {label}
      <button type="button" onClick={onClear} aria-label={`Hapus filter ${label}`} className="grid size-8 place-items-center rounded-full">
        <X className="size-4" aria-hidden="true" />
      </button>
    </span>
  )
}

function FilterSheet({ open, filter, onClose, onApply }: { open: boolean; filter: TxFilter; onClose: () => void; onApply: (f: TxFilter) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Filter">
      {open && <FilterForm filter={filter} onClose={onClose} onApply={onApply} />}
    </Sheet>
  )
}

function FilterForm({ filter, onClose, onApply }: { filter: TxFilter; onClose: () => void; onApply: (f: TxFilter) => void }) {
  const categories = useCategories() ?? []
  const wallets = useWallets() ?? []
  const [draft, setDraft] = useState(filter)
  const field = 'mt-1 min-h-12 w-full rounded-2xl bg-surface-muted px-4'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          Dari tanggal
          <input type="date" value={draft.from ?? ''} onChange={(e) => setDraft({ ...draft, from: e.target.value || undefined })} className={field} />
        </label>
        <label className="text-sm">
          Sampai tanggal
          <input type="date" value={draft.to ?? ''} onChange={(e) => setDraft({ ...draft, to: e.target.value || undefined })} className={field} />
        </label>
      </div>
      <label className="block text-sm">
        Kategori
        <select value={draft.categoryId ?? ''} onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || undefined })} className={field}>
          <option value="">Semua kategori</option>
          <optgroup label="Pengeluaran">
            {categories.filter((c) => c.kind === 'expense').map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? ' (arsip)' : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Pemasukan">
            {categories.filter((c) => c.kind === 'income').map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? ' (arsip)' : ''}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="block text-sm">
        Dompet
        <select value={draft.walletId ?? ''} onChange={(e) => setDraft({ ...draft, walletId: e.target.value || undefined })} className={field}>
          <option value="">Semua dompet</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
              {w.archived ? ' (arsip)' : ''}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          Nominal min.
          <input
            inputMode="numeric"
            value={draft.min !== undefined ? formatNumber(draft.min) : ''}
            onChange={(e) => setDraft({ ...draft, min: e.target.value ? parseAmountInput(e.target.value) : undefined })}
            placeholder="0"
            className={field}
          />
        </label>
        <label className="text-sm">
          Nominal maks.
          <input
            inputMode="numeric"
            value={draft.max !== undefined ? formatNumber(draft.max) : ''}
            onChange={(e) => setDraft({ ...draft, max: e.target.value ? parseAmountInput(e.target.value) : undefined })}
            placeholder="Tanpa batas"
            className={field}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            onApply({ q: filter.q, type: filter.type })
            onClose()
          }}
          className="min-h-12 rounded-2xl bg-surface-muted font-semibold"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(draft)
            onClose()
          }}
          className="min-h-12 rounded-2xl bg-primary font-semibold text-on-primary"
        >
          Terapkan
        </button>
      </div>
    </div>
  )
}
