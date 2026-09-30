import type { Transaction } from '../db/types'

/**
 * CSV export (FR-9.3): semicolon-separated (Excel in Indonesian locale), UTF-8 BOM
 * so emoji survive, plain positive numbers; direction comes from the "jenis" column.
 */

const BOM = '﻿'
const HEADER = ['tanggal', 'jam', 'jenis', 'kategori', 'dompet', 'dompet tujuan', 'nominal', 'catatan']

export function typeLabel(tx: Pick<Transaction, 'type' | 'amount'>): string {
  switch (tx.type) {
    case 'expense':
      return 'Pengeluaran'
    case 'income':
      return 'Pemasukan'
    case 'transfer':
      return 'Transfer'
    case 'refund':
      return 'Refund'
    case 'adjustment':
      return tx.amount >= 0 ? 'Penyesuaian masuk' : 'Penyesuaian keluar'
  }
}

/** Quotes when needed and neutralises spreadsheet formulas (CSV injection). */
export function csvCell(value: string): string {
  let v = value
  if (/^[=+@\t\r]/.test(v) || (/^-/.test(v) && !/^-?\d+$/.test(v))) v = `'${v}`
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function transactionsToCsv(
  txs: Transaction[],
  categoryName: (id: string) => string | undefined,
  walletName: (id: string) => string | undefined,
): string {
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.createdAt - b.createdAt)
    .map((tx) =>
      [
        tx.date,
        tx.time,
        typeLabel(tx),
        tx.categoryId ? (categoryName(tx.categoryId) ?? '') : '',
        walletName(tx.walletId) ?? '',
        tx.toWalletId ? (walletName(tx.toWalletId) ?? '') : '',
        String(Math.abs(tx.amount)),
        tx.note,
      ]
        .map(csvCell)
        .join(';'),
    )
  return BOM + [HEADER.join(';'), ...rows].join('\r\n') + '\r\n'
}
