import { describe, expect, it } from 'vitest'
import type { Transaction, Wallet } from '../db/types'
import { adjustmentFor, computeBalances, totalBalance, totalCreditDebt } from './balance'

const wallet = (id: string, over: Partial<Wallet> = {}): Wallet => ({
  id,
  name: id,
  type: 'cash',
  color: '',
  icon: '',
  initialBalance: 0,
  initialDate: '2026-01-01',
  includeInTotal: true,
  archived: false,
  order: 0,
  createdAt: 0,
  ...over,
})

let seq = 0
const tx = (over: Partial<Transaction>): Transaction => ({
  id: String(++seq),
  type: 'expense',
  amount: 0,
  walletId: 'cash',
  date: '2026-09-01',
  time: '12:00',
  note: '',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('computeBalances', () => {
  const wallets = [
    wallet('cash', { initialBalance: 350_000 }),
    wallet('bca', { type: 'bank', initialBalance: 3_780_000 }),
    wallet('gopay', { type: 'ewallet', initialBalance: 120_000 }),
  ]

  it('applies income, expense, refund and adjustment', () => {
    const balances = computeBalances(wallets, [
      tx({ type: 'expense', amount: 25_000 }),
      tx({ type: 'income', amount: 100_000 }),
      tx({ type: 'refund', amount: 5_000, categoryId: 'food' }),
      tx({ type: 'adjustment', amount: -30_000 }),
    ])
    expect(balances.get('cash')).toBe(350_000 - 25_000 + 100_000 + 5_000 - 30_000)
  })

  it('moves transfers between wallets without changing the total (acceptance: GoPay ← BCA)', () => {
    const txs = [tx({ type: 'transfer', amount: 100_000, walletId: 'bca', toWalletId: 'gopay' })]
    const balances = computeBalances(wallets, txs)
    expect(balances.get('bca')).toBe(3_680_000)
    expect(balances.get('gopay')).toBe(220_000)
    expect(totalBalance(wallets, balances)).toBe(350_000 + 3_780_000 + 120_000)
  })

  it('ignores transactions before the wallet initial date', () => {
    const w = [wallet('cash', { initialBalance: 50_000, initialDate: '2026-09-10' })]
    const balances = computeBalances(w, [tx({ amount: 10_000, date: '2026-09-09' }), tx({ amount: 1_000, date: '2026-09-10' })])
    expect(balances.get('cash')).toBe(49_000)
  })

  it('allows negative balances (FR-3.9)', () => {
    expect(computeBalances([wallet('cash')], [tx({ amount: 20_000 })]).get('cash')).toBe(-20_000)
  })
})

describe('credit cards (acceptance: Rp 500.000 purchase then payment)', () => {
  const wallets = [wallet('bca', { type: 'bank', initialBalance: 1_000_000 }), wallet('cc', { type: 'credit' })]

  it('purchase creates debt, payment clears it', () => {
    const purchase = tx({ type: 'expense', amount: 500_000, walletId: 'cc', categoryId: 'shop' })
    let balances = computeBalances(wallets, [purchase])
    expect(balances.get('cc')).toBe(-500_000)
    expect(totalCreditDebt(wallets, balances)).toBe(500_000)
    expect(totalBalance(wallets, balances)).toBe(500_000)

    const payment = tx({ type: 'transfer', amount: 500_000, walletId: 'bca', toWalletId: 'cc' })
    balances = computeBalances(wallets, [purchase, payment])
    expect(balances.get('cc')).toBe(0)
    expect(totalCreditDebt(wallets, balances)).toBe(0)
  })
})

describe('totalBalance', () => {
  it('skips archived and excluded wallets', () => {
    const wallets = [
      wallet('a', { initialBalance: 100 }),
      wallet('b', { initialBalance: 50, includeInTotal: false }),
      wallet('c', { initialBalance: 25, archived: true }),
    ]
    expect(totalBalance(wallets, computeBalances(wallets, []))).toBe(100)
  })
})

describe('adjustmentFor', () => {
  it('is the signed difference', () => {
    expect(adjustmentFor(350_000, 320_000)).toBe(-30_000)
    expect(adjustmentFor(-10, 0)).toBe(10)
  })
})
