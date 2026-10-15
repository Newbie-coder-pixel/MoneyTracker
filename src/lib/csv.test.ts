import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/types'
import { csvCell, transactionsToCsv } from './csv'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: '1',
  type: 'expense',
  amount: 25_000,
  categoryId: 'food',
  walletId: 'cash',
  date: '2026-09-29',
  time: '12:30',
  note: '',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('transactionsToCsv (FR-9.3)', () => {
  const csv = transactionsToCsv(
    [
      tx({ note: 'Makan siang 🍜; pedas' }),
      tx({ id: '2', type: 'transfer', amount: 100_000, categoryId: undefined, walletId: 'bca', toWalletId: 'gopay', date: '2026-09-28', note: 'Top up' }),
      tx({ id: '3', type: 'adjustment', amount: -30_000, categoryId: undefined, date: '2026-09-30' }),
    ],
    (id) => ({ food: 'Makan & Minum' })[id],
    (id) => ({ cash: 'Cash', bca: 'BCA', gopay: 'GoPay' })[id],
  )
  const lines = csv.split('\r\n')

  it('starts with a UTF-8 BOM and a semicolon header', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(lines[0].slice(1)).toBe('tanggal;jam;jenis;kategori;dompet;dompet tujuan;nominal;catatan')
  })

  it('sorts by date and writes plain positive numbers', () => {
    expect(lines[1]).toBe('2026-09-28;12:30;Transfer;;BCA;GoPay;100000;Top up')
    expect(lines[2]).toBe('2026-09-29;12:30;Pengeluaran;Makan & Minum;Cash;;25000;"Makan siang 🍜; pedas"')
    expect(lines[3]).toBe('2026-09-30;12:30;Penyesuaian keluar;;Cash;;30000;')
  })
})

describe('csvCell', () => {
  it('neutralises formulas but keeps plain numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('-5')).toBe('-5')
    expect(csvCell('- catatan')).toBe("'- catatan")
  })
})
