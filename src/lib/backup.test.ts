import { describe, expect, it } from 'vitest'
import { backupAgeDays, checkBackup } from './backup'

const wallet = { id: 'w1', name: 'Tunai', type: 'cash', initialBalance: 0, initialDate: '2026-01-01', archived: false }
const tx = { id: 't1', type: 'expense', amount: 25_000, categoryId: 'c1', walletId: 'w1', date: '2026-10-15', time: '11:13', note: '' }
const empty = { wallets: [], categories: [], transactions: [], budgets: [], recurring: [], recurringOccurrences: [], reminders: [], settings: [] }
const file = (data: Record<string, unknown>) => ({ app: 'money-tracker', schemaVersion: 1, exportedAt: '', data: { ...empty, ...data } })

describe('checkBackup', () => {
  it('validates app id, schema version and tables', () => {
    expect(checkBackup(file({ wallets: [wallet], transactions: [tx, { ...tx, id: 't2' }] }), 1)).toMatchObject({ ok: true, counts: { transactions: 2 } })
    expect(checkBackup({ ...file({}), app: 'other' }, 1).ok).toBe(false)
    expect(checkBackup({ ...file({}), schemaVersion: 2 }, 1)).toMatchObject({ ok: false, error: expect.stringContaining('lebih baru') })
    expect(checkBackup(file({ budgets: undefined }), 1).ok).toBe(false)
  })

  it('rejects a row the calculations would choke on, naming table, row and field', () => {
    expect(checkBackup(file({ transactions: [tx, { ...tx, amount: '25000' }] }), 1)).toEqual({
      ok: false,
      error: 'Backup rusak: transaksi baris 2 tidak valid (nominal). Data kamu tidak diubah.',
    })
    expect(checkBackup(file({ transactions: [{ ...tx, amount: 0 }] }), 1).ok).toBe(false)
    expect(checkBackup(file({ transactions: [{ ...tx, amount: 1.5 }] }), 1).ok).toBe(false)
    expect(checkBackup(file({ transactions: [{ ...tx, date: '15/10/2026' }] }), 1)).toMatchObject({ error: expect.stringContaining('(tanggal)') })
    expect(checkBackup(file({ transactions: [{ ...tx, type: 'gift' }] }), 1)).toMatchObject({ error: expect.stringContaining('(jenis)') })
    expect(checkBackup(file({ transactions: [1] }), 1)).toMatchObject({ error: expect.stringContaining('(isi)') })
    expect(checkBackup(file({ wallets: [{ ...wallet, initialBalance: null }] }), 1)).toMatchObject({ error: expect.stringContaining('dompet baris 1') })
    expect(checkBackup(file({ budgets: [{ id: 'b', categoryId: '__total__', period: '2026-10-01', amount: 1 }] }), 1)).toMatchObject({
      error: expect.stringContaining('(periode)'),
    })
    expect(checkBackup(file({ recurring: [{ id: 'r', template: { amount: 1, walletId: '' }, startDate: '2026-01-01' }] }), 1)).toMatchObject({
      error: expect.stringContaining('(dompet)'),
    })
    expect(checkBackup(file({ settings: [{ value: 1 }] }), 1).ok).toBe(false)
  })

  it('accepts signed adjustments and optional fields left out', () => {
    expect(checkBackup(file({ transactions: [{ ...tx, type: 'adjustment', amount: -5_000, categoryId: undefined }] }), 1).ok).toBe(true)
  })
})

describe('backupAgeDays', () => {
  it('computes backup age', () => {
    expect(backupAgeDays(undefined, undefined, 0)).toBeNull()
    expect(backupAgeDays(0, undefined, 31 * 86_400_000)).toBe(31)
  })
})
