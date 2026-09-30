import type { DateKey, Recurring, Transaction, Wallet } from '../db/types'
import { cardStatement } from './creditCard'
import { addDays } from './dates'
import { occurrencesBetween } from './recurring'

export interface UpcomingBill {
  /** `recurring:<id>` or `credit:<walletId>` — stable key for reminders. */
  key: string
  kind: 'recurring' | 'credit'
  refId: string
  name: string
  date: DateKey
  amount: number
}

/**
 * Bills due in [today, today + days − 1]: expense schedules not yet recorded or
 * skipped, and unpaid credit-card statements (FR-4.1, FR-8.1 b/c).
 */
export function upcomingBills(
  input: {
    recurring: Recurring[]
    /** `${recurringId}:${date}` for occurrences already done or skipped. */
    handled: Set<string>
    cards: Wallet[]
    txs: Pick<Transaction, 'type' | 'amount' | 'walletId' | 'toWalletId' | 'date'>[]
  },
  today: DateKey,
  days: number,
): UpcomingBill[] {
  const end = addDays(today, days - 1)
  const bills: UpcomingBill[] = []

  for (const r of input.recurring) {
    if (r.paused || r.template.type !== 'expense') continue
    for (const date of occurrencesBetween(r, today, end)) {
      if (input.handled.has(`${r.id}:${date}`)) continue
      bills.push({ key: `recurring:${r.id}:${date}`, kind: 'recurring', refId: r.id, name: r.name, date, amount: r.template.amount })
    }
  }

  for (const card of input.cards) {
    if (card.type !== 'credit' || card.archived) continue
    const statement = cardStatement(card, input.txs, today)
    if (!statement || statement.paid || statement.dueDate < today || statement.dueDate > end) continue
    bills.push({
      key: `credit:${card.id}:${statement.dueDate}`,
      kind: 'credit',
      refId: card.id,
      name: card.name,
      date: statement.dueDate,
      amount: statement.billAmount,
    })
  }

  return bills.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
