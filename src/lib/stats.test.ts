import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/types'
import { weekPeriodOf } from './period'
import { cumulative, dailyFlows, expenseByCategory, flowTotals } from './stats'
import { eachDay } from './dates'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  type: 'expense',
  amount: 0,
  walletId: 'cash',
  date: '2026-09-29',
  time: '12:00',
  note: '',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const week = weekPeriodOf('2026-09-29') // 28 Sep – 4 Oct

describe('expenseByCategory', () => {
  it('excludes transfers and adjustments', () => {
    const rows = expenseByCategory(
      [
        tx({ amount: 25_000, categoryId: 'food' }),
        tx({ type: 'transfer', amount: 100_000, toWalletId: 'gopay' }),
        tx({ type: 'adjustment', amount: -50_000 }),
      ],
      week,
    )
    expect(rows).toEqual([{ categoryId: 'food', amount: 25_000 }])
  })

  it('subtracts refunds from their category, never below 0', () => {
    const rows = expenseByCategory(
      [
        tx({ amount: 200_000, categoryId: 'shop' }),
        tx({ type: 'refund', amount: 50_000, categoryId: 'shop' }),
        tx({ type: 'refund', amount: 30_000, categoryId: 'food' }), // refund with no expense this period
      ],
      week,
    )
    expect(rows).toEqual([{ categoryId: 'shop', amount: 150_000 }])
  })

  it('filters by wallet and period', () => {
    const txs = [
      tx({ amount: 10_000, categoryId: 'food', walletId: 'gopay' }),
      tx({ amount: 20_000, categoryId: 'food' }),
      tx({ amount: 99_000, categoryId: 'food', date: '2026-09-27' }), // previous week
    ]
    expect(expenseByCategory(txs, week, { walletId: 'gopay' })).toEqual([{ categoryId: 'food', amount: 10_000 }])
    expect(flowTotals(txs, week).expense).toBe(30_000)
  })
})

describe('dailyFlows (acceptance: weekly bars sum to the week history)', () => {
  it('produces one entry per day Mon–Sun', () => {
    const txs = [
      tx({ amount: 65_000, categoryId: 'food', date: '2026-09-28' }),
      tx({ amount: 45_000, categoryId: 'food', date: '2026-09-29' }),
      tx({ type: 'income', amount: 6_500_000, categoryId: 'salary', date: '2026-09-29' }),
    ]
    const days = dailyFlows(txs, eachDay(week.start, week.end))
    expect(days).toHaveLength(7)
    expect(days[0]).toEqual({ date: '2026-09-28', expense: 65_000, income: 0 })
    expect(days[1].income).toBe(6_500_000)
    expect(days.reduce((s, d) => s + d.expense, 0)).toBe(flowTotals(txs, week).expense)
  })
})

describe('cumulative', () => {
  it('runs a total', () => {
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6])
  })
})

describe('elapsedDays / peakDay / foldCategories', () => {
  it('counts elapsed days in the current period', async () => {
    const { elapsedDays } = await import('./stats')
    expect(elapsedDays(week, '2026-09-30')).toBe(3)
    expect(elapsedDays(week, '2026-10-10')).toBe(7)
    expect(elapsedDays(week, '2026-09-01')).toBe(0)
  })

  it('finds the peak day', async () => {
    const { peakDay } = await import('./stats')
    expect(peakDay([{ date: 'a', expense: 5 }, { date: 'b', expense: 9 }])).toEqual({ date: 'b', expense: 9 })
    expect(peakDay([{ date: 'a', expense: 0 }])).toBeNull()
  })

  it('folds the tail into Lainnya', async () => {
    const { foldCategories, OTHER_SLICE } = await import('./stats')
    const rows = [5, 4, 3, 2, 1].map((amount, i) => ({ categoryId: String(i), amount }))
    expect(foldCategories(rows, 3)).toEqual([...rows.slice(0, 3), { categoryId: OTHER_SLICE, amount: 3 }])
    expect(foldCategories(rows.slice(0, 4), 3)).toHaveLength(4) // folding a single row gains nothing
  })
})
