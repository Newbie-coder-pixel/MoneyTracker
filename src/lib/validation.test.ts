import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT } from './money'
import { NOTE_MAX, validateTransaction } from './validation'

describe('validateTransaction (FR-1.2, FR-1.8)', () => {
  const expense = { type: 'expense' as const, amount: 25_000, categoryId: 'c', walletId: 'w' }

  it('accepts a complete entry', () => {
    expect(validateTransaction(expense)).toBeNull()
    expect(validateTransaction({ type: 'transfer', amount: 1, walletId: 'a', toWalletId: 'b' })).toBeNull()
  })

  it('needs a positive whole Rupiah amount up to the max', () => {
    expect(validateTransaction({ ...expense, amount: 0 })).toBe('Nominal harus lebih dari 0')
    expect(validateTransaction({ ...expense, amount: -1 })).toBe('Nominal harus lebih dari 0')
    expect(validateTransaction({ ...expense, amount: 1.5 })).toBe('Nominal harus lebih dari 0')
    expect(validateTransaction({ ...expense, amount: MAX_AMOUNT })).toBeNull()
    expect(validateTransaction({ ...expense, amount: MAX_AMOUNT + 1 })).toContain('maksimal')
  })

  it('lets an adjustment be signed', () => {
    expect(validateTransaction({ type: 'adjustment', amount: -5_000, walletId: 'w' })).toBeNull()
  })

  it('needs a wallet, and a category for expense, income and refund', () => {
    expect(validateTransaction({ ...expense, walletId: undefined })).toBe('Pilih dompet')
    for (const type of ['expense', 'income', 'refund'] as const)
      expect(validateTransaction({ ...expense, type, categoryId: undefined })).toBe('Pilih kategori')
  })

  it('needs two different wallets for a transfer', () => {
    expect(validateTransaction({ type: 'transfer', amount: 1, walletId: 'a' })).toBe('Pilih dompet tujuan')
    expect(validateTransaction({ type: 'transfer', amount: 1, walletId: 'a', toWalletId: 'a' })).toBe('Dompet asal dan tujuan harus berbeda')
  })

  it('caps the note length', () => {
    expect(validateTransaction({ ...expense, note: 'x'.repeat(NOTE_MAX) })).toBeNull()
    expect(validateTransaction({ ...expense, note: 'x'.repeat(NOTE_MAX + 1) })).toContain(`${NOTE_MAX}`)
  })
})
