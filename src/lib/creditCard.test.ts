import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/types'
import { cardStatement, limitUsage } from './creditCard'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  type: 'expense',
  amount: 0,
  walletId: 'cc',
  date: '2026-09-01',
  time: '12:00',
  note: '',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const card = { id: 'cc', statementDay: 25, dueDay: 15 }

describe('cardStatement', () => {
  it('bills charges between the two statement dates', () => {
    const s = cardStatement(
      card,
      [
        tx({ amount: 280_000, date: '2026-09-02' }),
        tx({ amount: 95_000, date: '2026-09-25' }), // on the statement date: included
        tx({ amount: 75_000, date: '2026-09-26' }), // next cycle
        tx({ amount: 10_000, date: '2026-08-25' }), // previous cycle
      ],
      '2026-10-01',
    )
    expect(s).toEqual({ statementDate: '2026-09-25', billAmount: 375_000, dueDate: '2026-10-15', paid: false })
  })

  it('is paid once payments after the statement cover it', () => {
    const s = cardStatement(
      card,
      [
        tx({ amount: 500_000, date: '2026-09-10' }),
        tx({ type: 'transfer', amount: 500_000, walletId: 'bca', toWalletId: 'cc', date: '2026-09-28' }),
      ],
      '2026-10-01',
    )
    expect(s?.paid).toBe(true)
    expect(s?.billAmount).toBe(0)
  })

  it('handles a statement day later in the month than today', () => {
    expect(cardStatement(card, [], '2026-09-10')?.statementDate).toBe('2026-08-25')
  })

  it('needs statement and due days', () => {
    expect(cardStatement({ id: 'cc' }, [], '2026-10-01')).toBeNull()
  })
})

describe('limitUsage', () => {
  it('is debt over limit', () => {
    expect(limitUsage(-450_000, 5_000_000)).toBeCloseTo(0.09)
    expect(limitUsage(100, 5_000_000)).toBe(0)
  })
})
