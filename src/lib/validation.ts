import type { TransactionType } from '../db/types'
import { MAX_AMOUNT } from './money'

export interface TransactionInput {
  type: TransactionType
  amount: number
  categoryId?: string
  walletId?: string
  toWalletId?: string
  note?: string
}

export const NOTE_MAX = 140

/** Returns an Indonesian error message, or null when valid (FR-1.2, FR-1.8). */
export function validateTransaction(input: TransactionInput): string | null {
  if (input.type !== 'adjustment') {
    if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Nominal harus lebih dari 0'
    if (input.amount > MAX_AMOUNT) return 'Nominal maksimal Rp 999.999.999.999'
  }
  if (!input.walletId) return 'Pilih dompet'
  if ((input.type === 'expense' || input.type === 'income' || input.type === 'refund') && !input.categoryId)
    return 'Pilih kategori'
  if (input.type === 'transfer') {
    if (!input.toWalletId) return 'Pilih dompet tujuan'
    if (input.toWalletId === input.walletId) return 'Dompet asal dan tujuan harus berbeda'
  }
  if ((input.note ?? '').length > NOTE_MAX) return `Catatan maksimal ${NOTE_MAX} karakter`
  return null
}
