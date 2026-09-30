import type { DateKey, Transaction } from '../db/types'
import { diffDays } from './dates'
import type { Period } from './period'

type StatTx = Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'walletId' | 'date'>

export interface StatFilter {
  /** Only transactions on this wallet (FR-5.4); undefined = all wallets. */
  walletId?: string
}

const inRange = (tx: StatTx, period: Period) => tx.date >= period.start && tx.date <= period.end
const matches = (tx: StatTx, filter: StatFilter) => !filter.walletId || tx.walletId === filter.walletId

/**
 * Net expense per category: expenses minus refunds to that category, never below 0
 * (FR-1.9, PRD §6.2). Transfers and adjustments are ignored. Sorted largest first.
 */
export function expenseByCategory(txs: StatTx[], period: Period, filter: StatFilter = {}): { categoryId: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const tx of txs) {
    if (!inRange(tx, period) || !matches(tx, filter) || !tx.categoryId) continue
    if (tx.type === 'expense') totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount)
    else if (tx.type === 'refund') totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) - tx.amount)
  }
  return [...totals]
    .map(([categoryId, amount]) => ({ categoryId, amount: Math.max(0, amount) }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function incomeByCategory(txs: StatTx[], period: Period, filter: StatFilter = {}): { categoryId: string; amount: number }[] {
  const totals = new Map<string, number>()
  for (const tx of txs) {
    if (tx.type !== 'income' || !inRange(tx, period) || !matches(tx, filter) || !tx.categoryId) continue
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount)
  }
  return [...totals].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount)
}

export function flowTotals(txs: StatTx[], period: Period, filter: StatFilter = {}): { income: number; expense: number } {
  const expense = expenseByCategory(txs, period, filter).reduce((s, r) => s + r.amount, 0)
  const income = incomeByCategory(txs, period, filter).reduce((s, r) => s + r.amount, 0)
  return { income, expense }
}

/** Net expense of one category in a period — what its budget measures. */
export function categorySpent(txs: StatTx[], period: Period, categoryId: string): number {
  return expenseByCategory(txs, period).find((r) => r.categoryId === categoryId)?.amount ?? 0
}

/** Per-day net expense and income for each day of the period (bars, cumulative line). */
export function dailyFlows(txs: StatTx[], days: DateKey[], filter: StatFilter = {}): { date: DateKey; expense: number; income: number }[] {
  const expense = new Map<DateKey, number>()
  const income = new Map<DateKey, number>()
  for (const tx of txs) {
    if (!matches(tx, filter)) continue
    if (tx.type === 'expense') expense.set(tx.date, (expense.get(tx.date) ?? 0) + tx.amount)
    else if (tx.type === 'refund') expense.set(tx.date, (expense.get(tx.date) ?? 0) - tx.amount)
    else if (tx.type === 'income') income.set(tx.date, (income.get(tx.date) ?? 0) + tx.amount)
  }
  return days.map((date) => ({ date, expense: Math.max(0, expense.get(date) ?? 0), income: income.get(date) ?? 0 }))
}

/** Days of the period that have started (all of them once it's over) — the divisor for "rata-rata per hari". */
export function elapsedDays(period: Period, today: DateKey): number {
  if (today < period.start) return 0
  const end = today < period.end ? today : period.end
  return diffDays(period.start, end) + 1
}

/** The day with the highest expense, or null when nothing was spent. */
export function peakDay(days: { date: DateKey; expense: number }[]): { date: DateKey; expense: number } | null {
  let peak: { date: DateKey; expense: number } | null = null
  for (const d of days) if (d.expense > 0 && (!peak || d.expense > peak.expense)) peak = d
  return peak
}

export const OTHER_SLICE = '__other__'

/** Keeps the top N categories and folds the rest into one "Lainnya" slice (never a generated colour). */
export function foldCategories(rows: { categoryId: string; amount: number }[], top: number) {
  if (rows.length <= top + 1) return rows
  const rest = rows.slice(top).reduce((s, r) => s + r.amount, 0)
  return [...rows.slice(0, top), { categoryId: OTHER_SLICE, amount: rest }]
}

/** Running total of daily values. */
export function cumulative(values: number[]): number[] {
  let sum = 0
  return values.map((v) => (sum += v))
}
