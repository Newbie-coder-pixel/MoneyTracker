import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/types'
import { filterFromParams, filterToParams, filterTransactions, groupByDay } from './filter'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  type: 'expense',
  amount: 10_000,
  walletId: 'cash',
  date: '2026-09-29',
  time: '12:00',
  note: '',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const names: Record<string, string> = { food: 'Makan & Minum', transport: 'Transportasi' }
const name = (id: string) => names[id]

describe('filterTransactions', () => {
  const txs = [
    tx({ note: 'Makan siang Padang', categoryId: 'food' }),
    tx({ note: 'Ojol ke kantor', categoryId: 'transport', walletId: 'gopay', amount: 18_000 }),
    tx({ type: 'transfer', walletId: 'bca', toWalletId: 'gopay', amount: 200_000, date: '2026-09-26' }),
    tx({ type: 'income', categoryId: 'salary', amount: 6_500_000, walletId: 'bca' }),
  ]

  it('searches note and category name, case-insensitively', () => {
    expect(filterTransactions(txs, { q: 'padang' }, name)).toHaveLength(1)
    expect(filterTransactions(txs, { q: 'TRANSPORT' }, name)).toHaveLength(1)
  })

  it('matches a wallet on either side of a transfer', () => {
    expect(filterTransactions(txs, { walletId: 'gopay' }, name)).toHaveLength(2)
  })

  it('filters by type, date and amount range', () => {
    expect(filterTransactions(txs, { type: 'income' }, name)).toHaveLength(1)
    expect(filterTransactions(txs, { from: '2026-09-27' }, name)).toHaveLength(3)
    expect(filterTransactions(txs, { min: 15_000, max: 250_000 }, name)).toHaveLength(2)
  })
})

describe('URL params round-trip', () => {
  it('preserves filters and unrelated params', () => {
    const params = filterToParams({ q: 'kopi', categoryId: 'food', min: 1000 }, new URLSearchParams('add=expense'))
    expect(params.get('add')).toBe('expense')
    expect(filterFromParams(params)).toEqual({ q: 'kopi', categoryId: 'food', min: 1000, type: undefined, walletId: undefined, from: undefined, to: undefined, max: undefined })
  })

  it('ignores unknown types', () => {
    expect(filterFromParams(new URLSearchParams('type=bogus')).type).toBeUndefined()
  })
})

describe('groupByDay', () => {
  it('groups consecutive days with subtotals', () => {
    const groups = groupByDay([
      tx({ date: '2026-09-29', amount: 25_000 }),
      tx({ date: '2026-09-29', type: 'income', amount: 100 }),
      tx({ date: '2026-09-28', amount: 5_000 }),
      tx({ date: '2026-09-28', type: 'refund', amount: 1_000 }),
    ])
    expect(groups.map((g) => [g.date, g.expense, g.income])).toEqual([
      ['2026-09-29', 25_000, 100],
      ['2026-09-28', 4_000, 0],
    ])
  })
})
