import { describe, expect, it } from 'vitest'
import type { Recurring, Wallet } from '../db/types'
import { upcomingBills } from './bills'

const kos: Recurring = {
  id: 'kos',
  name: 'Kos',
  template: { type: 'expense', amount: 1_500_000, categoryId: 'cat-housing', walletId: 'bca', note: '' },
  frequency: 'monthly',
  interval: 1,
  dayOfMonth: 1,
  startDate: '2026-01-01',
  mode: 'confirm',
  paused: false,
  createdAt: 0,
}

const card: Wallet = {
  id: 'cc',
  name: 'BCA Card',
  type: 'credit',
  color: '',
  icon: '',
  initialBalance: 0,
  initialDate: '2026-01-01',
  includeInTotal: true,
  statementDay: 25,
  dueDay: 3,
  archived: false,
  order: 0,
  createdAt: 0,
}

describe('upcomingBills', () => {
  it('lists recurring expenses and unpaid card bills within the window, sorted', () => {
    const bills = upcomingBills(
      { recurring: [kos], handled: new Set(), cards: [card], txs: [{ type: 'expense', amount: 200_000, walletId: 'cc', date: '2026-09-10' }] },
      '2026-09-29',
      7,
    )
    expect(bills.map((b) => [b.name, b.date, b.amount])).toEqual([
      ['Kos', '2026-10-01', 1_500_000],
      ['BCA Card', '2026-10-03', 200_000],
    ])
  })

  it('hides handled occurrences, paused schedules and income', () => {
    const bills = upcomingBills(
      {
        recurring: [kos, { ...kos, id: 'p', paused: true }, { ...kos, id: 'gaji', template: { ...kos.template, type: 'income' } }],
        handled: new Set(['kos:2026-10-01']),
        cards: [],
        txs: [],
      },
      '2026-09-29',
      7,
    )
    expect(bills).toEqual([])
  })
})
