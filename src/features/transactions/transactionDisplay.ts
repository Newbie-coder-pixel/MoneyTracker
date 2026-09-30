import type { Category, Transaction } from '../../db/types'
import { formatRupiah } from '../../lib/money'

export function transactionTitle(tx: Transaction, categories: Map<string, Category>): string {
  if (tx.note) return tx.note
  if (tx.type === 'transfer') return 'Transfer'
  if (tx.type === 'adjustment') return 'Penyesuaian saldo'
  const name = tx.categoryId ? categories.get(tx.categoryId)?.name : undefined
  return tx.type === 'refund' ? `Refund ${name ?? ''}`.trim() : (name ?? 'Transaksi')
}

/** Signed amount and colour as the user reads it: money out is red "-", money in green "+". */
export function signedAmount(tx: Transaction): { text: string; className: string } {
  switch (tx.type) {
    case 'expense':
      return { text: `-${formatRupiah(tx.amount)}`, className: 'text-expense' }
    case 'income':
    case 'refund':
      return { text: `+${formatRupiah(tx.amount)}`, className: 'text-income' }
    case 'adjustment':
      return { text: `${tx.amount >= 0 ? '+' : ''}${formatRupiah(tx.amount)}`, className: 'text-text-muted' }
    case 'transfer':
      return { text: formatRupiah(tx.amount), className: 'text-primary' }
  }
}
