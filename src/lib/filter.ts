import type { DateKey, Transaction, TransactionType } from '../db/types'

export interface TxFilter {
  q?: string
  type?: TransactionType
  categoryId?: string
  walletId?: string
  from?: DateKey
  to?: DateKey
  min?: number
  max?: number
}

const FILTER_PARAMS = ['q', 'type', 'cat', 'wallet', 'from', 'to', 'min', 'max'] as const
const TYPES: TransactionType[] = ['expense', 'income', 'transfer', 'refund', 'adjustment']

/** Filters live in the URL so Statistik can deep-link a drill-down into Riwayat (FR-5.5). */
export function filterFromParams(params: URLSearchParams): TxFilter {
  const num = (key: string) => {
    const v = Number(params.get(key))
    return params.get(key) && Number.isFinite(v) ? v : undefined
  }
  const type = params.get('type') as TransactionType | null
  return {
    q: params.get('q') || undefined,
    type: type && TYPES.includes(type) ? type : undefined,
    categoryId: params.get('cat') || undefined,
    walletId: params.get('wallet') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    min: num('min'),
    max: num('max'),
  }
}

export function filterToParams(filter: TxFilter, base = new URLSearchParams()): URLSearchParams {
  const params = new URLSearchParams(base)
  for (const key of FILTER_PARAMS) params.delete(key)
  const set = (key: string, value: string | number | undefined) => value !== undefined && value !== '' && params.set(key, String(value))
  set('q', filter.q)
  set('type', filter.type)
  set('cat', filter.categoryId)
  set('wallet', filter.walletId)
  set('from', filter.from)
  set('to', filter.to)
  set('min', filter.min)
  set('max', filter.max)
  return params
}

/** Count of active filters other than search and type chips (for the filter button badge). */
export function advancedFilterCount(f: TxFilter): number {
  return [f.categoryId, f.walletId, f.from, f.to, f.min, f.max].filter((v) => v !== undefined).length
}

/**
 * Search matches the note or category name (FR-4.3). Wallet matches either side of
 * a transfer. Amount range uses the absolute amount.
 */
export function filterTransactions(txs: Transaction[], f: TxFilter, categoryName: (id: string) => string | undefined): Transaction[] {
  const q = f.q?.trim().toLowerCase()
  return txs.filter((tx) => {
    if (f.type && tx.type !== f.type) return false
    if (f.categoryId && tx.categoryId !== f.categoryId) return false
    if (f.walletId && tx.walletId !== f.walletId && tx.toWalletId !== f.walletId) return false
    if (f.from && tx.date < f.from) return false
    if (f.to && tx.date > f.to) return false
    const abs = Math.abs(tx.amount)
    if (f.min !== undefined && abs < f.min) return false
    if (f.max !== undefined && abs > f.max) return false
    if (q) {
      const name = tx.categoryId ? (categoryName(tx.categoryId) ?? '') : ''
      if (!tx.note.toLowerCase().includes(q) && !name.toLowerCase().includes(q)) return false
    }
    return true
  })
}

export interface DayGroup {
  date: DateKey
  txs: Transaction[]
  /** Net expense (expenses − refunds) and income of the day, for the subtotal. */
  expense: number
  income: number
}

/** Groups already-sorted transactions by day, keeping order (FR-4.2). */
export function groupByDay(sorted: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const tx of sorted) {
    let group = groups[groups.length - 1]
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, txs: [], expense: 0, income: 0 }
      groups.push(group)
    }
    group.txs.push(tx)
    if (tx.type === 'expense') group.expense += tx.amount
    else if (tx.type === 'refund') group.expense -= tx.amount
    else if (tx.type === 'income') group.income += tx.amount
  }
  return groups
}
