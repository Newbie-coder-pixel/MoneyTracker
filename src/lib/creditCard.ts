import type { DateKey, Transaction, Wallet } from '../db/types'
import { addDays, addMonthsClamped, parseDateKey } from './dates'

type CardTx = Pick<Transaction, 'type' | 'amount' | 'walletId' | 'toWalletId' | 'date'>

export interface CardStatement {
  /** Most recent statement date on/before today. */
  statementDate: DateKey
  /** Charges in (previous statement, statement] − payments after the statement date; ≥ 0 (FR-3.7). */
  billAmount: number
  /** Next due date after the statement date. */
  dueDate: DateKey
  paid: boolean
}

/** Most recent date with day `day` (clamped to month end) that is ≤ date. */
function lastDayOnOrBefore(date: DateKey, day: number): DateKey {
  const { year, month } = parseDateKey(date)
  const thisMonth = addMonthsClamped(year, month, 0, day)
  return thisMonth <= date ? thisMonth : addMonthsClamped(year, month, -1, day)
}

/** First date with day `day` (clamped) strictly after date. */
function firstDayAfter(date: DateKey, day: number): DateKey {
  const { year, month } = parseDateKey(date)
  const thisMonth = addMonthsClamped(year, month, 0, day)
  return thisMonth > date ? thisMonth : addMonthsClamped(year, month, 1, day)
}

export function cardStatement(
  card: Pick<Wallet, 'id' | 'statementDay' | 'dueDay'>,
  txs: CardTx[],
  today: DateKey,
): CardStatement | null {
  if (!card.statementDay || !card.dueDay) return null
  const statementDate = lastDayOnOrBefore(today, card.statementDay)
  const previous = lastDayOnOrBefore(addDays(statementDate, -1), card.statementDay)

  let charges = 0
  let payments = 0
  for (const tx of txs) {
    const inCycle = tx.date > previous && tx.date <= statementDate
    if (tx.walletId === card.id && inCycle) {
      if (tx.type === 'expense') charges += tx.amount
      else if (tx.type === 'refund') charges -= tx.amount
    }
    if (tx.type === 'transfer' && tx.toWalletId === card.id && tx.date > statementDate) payments += tx.amount
  }

  const billAmount = Math.max(0, charges - payments)
  return {
    statementDate,
    billAmount,
    dueDate: firstDayAfter(statementDate, card.dueDay),
    paid: billAmount === 0,
  }
}

/** Used limit as a fraction (0–1+); debt is the negative balance. */
export function limitUsage(balance: number, limit: number | undefined): number {
  if (!limit || limit <= 0) return 0
  return Math.max(0, -balance) / limit
}
