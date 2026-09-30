import { describe, expect, it } from 'vitest'
import type { Transaction } from '../db/types'
import { csvCell, transactionsToCsv } from './csv'
import { hashPin, isValidPin, newSalt, verifyPin } from './pin'
import { backupAgeDays, checkBackup } from './backup'

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

describe('pin', () => {
  it('hashes with a salt and verifies', async () => {
    const salt = newSalt()
    const hash = await hashPin('1234', salt)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyPin('1234', salt, hash)).toBe(true)
    expect(await verifyPin('4321', salt, hash)).toBe(false)
    expect(await hashPin('1234', newSalt())).not.toBe(hash)
  })

  it('accepts 4–6 digits only', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })
})

describe('backup checks', () => {
  const data = { wallets: [], categories: [], transactions: [1, 2], budgets: [], recurring: [], recurringOccurrences: [], reminders: [], settings: [] }

  it('validates app id, schema version and tables', () => {
    expect(checkBackup({ app: 'money-tracker', schemaVersion: 1, exportedAt: '', data }, 1)).toMatchObject({ ok: true, counts: { transactions: 2 } })
    expect(checkBackup({ app: 'other', schemaVersion: 1, data }, 1).ok).toBe(false)
    expect(checkBackup({ app: 'money-tracker', schemaVersion: 2, data }, 1)).toMatchObject({ ok: false, error: expect.stringContaining('lebih baru') })
    expect(checkBackup({ app: 'money-tracker', schemaVersion: 1, data: { ...data, budgets: undefined } }, 1).ok).toBe(false)
  })

  it('computes backup age', () => {
    expect(backupAgeDays(undefined, undefined, 0)).toBeNull()
    expect(backupAgeDays(0, undefined, 31 * 86_400_000)).toBe(31)
  })
})
