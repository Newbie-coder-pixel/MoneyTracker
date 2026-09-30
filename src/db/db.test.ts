import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { monthPeriodOf } from '../lib/period'
import { todayKey } from '../lib/dates'
import { budgetsWithSpend, checkBudgets } from './budgets'
import { processRecurring } from './recurring'
import { db } from './schema'
import { CASH_WALLET_ID, ensureSeeded } from './seed'
import { setSetting } from './settings'
import { deleteTransaction, restoreTransactions, saveTransaction } from './transactions'
import { TOTAL_BUDGET_ID, type Recurring } from './types'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  await ensureSeeded()
})

const expense = (amount: number, date = todayKey()) =>
  saveTransaction({ type: 'expense', amount, categoryId: 'cat-food', walletId: CASH_WALLET_ID, date, time: '12:00', note: '' })

describe('seed', () => {
  it('is idempotent', async () => {
    await ensureSeeded()
    await ensureSeeded()
    expect(await db.categories.count()).toBe(19)
    expect(await db.wallets.count()).toBe(1)
  })
})

describe('budget alerts end-to-end', () => {
  it('fires once at 80% and once at 100%', async () => {
    const period = monthPeriodOf(todayKey(), 1)
    await db.budgets.add({ id: 'b', categoryId: 'cat-food', period: period.key, amount: 1_000_000, autoRepeat: true, alerted80: false, alerted100: false })

    expect((await expense(500_000)).alerts).toEqual([])
    const at80 = await expense(300_000)
    expect(at80.alerts.map((a) => a.threshold)).toEqual([80])
    expect((await expense(10_000)).alerts).toEqual([])
    const at100 = await expense(190_000)
    expect(at100.alerts.map((a) => a.threshold)).toEqual([100])
    expect(await db.reminders.count()).toBe(2)
  })

  it('re-arms after a delete and restores on undo', async () => {
    const period = monthPeriodOf(todayKey(), 1)
    await db.budgets.add({ id: 'b', categoryId: TOTAL_BUDGET_ID, period: period.key, amount: 100_000, autoRepeat: true, alerted80: false, alerted100: false })
    const { id } = await expense(90_000)
    expect((await db.budgets.get('b'))?.alerted80).toBe(true)

    const removed = await deleteTransaction(id)
    expect((await db.budgets.get('b'))?.alerted80).toBe(false)

    await restoreTransactions(removed)
    expect((await db.budgets.get('b'))?.alerted80).toBe(true)
    expect((await budgetsWithSpend(period))[0].spent).toBe(90_000)
  })

  it('carries autoRepeat budgets into a new period', async () => {
    await db.budgets.add({ id: 'old', categoryId: 'cat-food', period: '2020-01', amount: 5, autoRepeat: true, alerted80: true, alerted100: false })
    await checkBudgets([todayKey()])
    const current = await db.budgets.where('period').equals(monthPeriodOf(todayKey(), 1).key).toArray()
    expect(current).toMatchObject([{ categoryId: 'cat-food', amount: 5, alerted80: false }])
  })
})

describe('transfer with admin fee (FR-1.5)', () => {
  it('stores the fee as a linked expense and removes it with the transfer', async () => {
    await db.wallets.add({ ...(await db.wallets.get(CASH_WALLET_ID))!, id: 'bca', name: 'BCA', type: 'bank' })
    const { id } = await saveTransaction({
      type: 'transfer',
      amount: 100_000,
      walletId: 'bca',
      toWalletId: CASH_WALLET_ID,
      date: todayKey(),
      time: '10:00',
      note: '',
      adminFee: 2_500,
    })
    const fee = await db.transactions.where('linkedId').equals(id).first()
    expect(fee).toMatchObject({ type: 'expense', amount: 2_500, categoryId: 'cat-admin-fee', walletId: 'bca' })

    await deleteTransaction(id)
    expect(await db.transactions.count()).toBe(0)
  })

  it('rejects the same source and destination', async () => {
    await expect(
      saveTransaction({ type: 'transfer', amount: 1, walletId: CASH_WALLET_ID, toWalletId: CASH_WALLET_ID, date: todayKey(), time: '10:00', note: '' }),
    ).rejects.toThrow('berbeda')
  })
})

describe('recurring catch-up (acceptance: app unopened for 3 months)', () => {
  const kos = (mode: Recurring['mode']): Recurring => ({
    id: 'kos',
    name: 'Kos',
    template: { type: 'expense', amount: 1_500_000, categoryId: 'cat-housing', walletId: CASH_WALLET_ID, note: '' },
    frequency: 'monthly',
    interval: 1,
    dayOfMonth: 1,
    startDate: '2026-07-01',
    mode,
    paused: false,
    lastProcessedDate: '2026-07-01',
    createdAt: 0,
  })

  it('creates 3 transactions without duplicates, even when run twice', async () => {
    await db.recurring.add(kos('auto'))
    await Promise.all([processRecurring('2026-10-05'), processRecurring('2026-10-05')])
    await processRecurring('2026-10-05')
    const txs = await db.transactions.where('recurringId').equals('kos').sortBy('date')
    expect(txs.map((t) => t.date)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
    expect(await db.recurringOccurrences.count()).toBe(3)
  })

  it('confirm mode creates pending occurrences only', async () => {
    await db.recurring.add(kos('confirm'))
    expect(await processRecurring('2026-10-05')).toEqual({ created: 0, pending: 3 })
    expect(await db.transactions.count()).toBe(0)
  })

  it('does not recreate a deleted generated transaction (FR-7.8)', async () => {
    await db.recurring.add({ ...kos('auto'), lastProcessedDate: '2026-09-30' })
    await processRecurring('2026-10-05')
    const [tx] = await db.transactions.toArray()
    await deleteTransaction(tx.id)
    await db.recurring.update('kos', { lastProcessedDate: '2026-09-30' }) // force a re-scan
    await processRecurring('2026-10-05')
    expect(await db.transactions.count()).toBe(0)
  })
})

describe('month start day', () => {
  it('uses the setting when grouping budgets', async () => {
    await setSetting('monthStartDay', 25)
    const period = monthPeriodOf(todayKey(), 25)
    await db.budgets.add({ id: 'b', categoryId: 'cat-food', period: period.key, amount: 10, autoRepeat: false, alerted80: false, alerted100: false })
    const { alerts } = await expense(10)
    expect(alerts).toHaveLength(1)
  })
})

describe('wallet rules (FR-3.8)', () => {
  const addWallet = async (id: string, initialBalance = 0) =>
    db.wallets.add({ ...(await db.wallets.get(CASH_WALLET_ID))!, id, name: id, initialBalance })

  it('keeps at least one active wallet', async () => {
    const { archiveBlocker, deleteWallet } = await import('./wallets')
    expect(await archiveBlocker(CASH_WALLET_ID)).toMatch('Minimal')
    await expect(deleteWallet(CASH_WALLET_ID)).rejects.toThrow('Minimal')
  })

  it('archives only at zero balance, deletes only without transactions', async () => {
    const { archiveBlocker, canDeleteWallet } = await import('./wallets')
    await addWallet('gopay', 50_000)
    expect(await archiveBlocker('gopay')).toMatch('Rp 0')
    expect(await canDeleteWallet('gopay')).toBe(true)
    await saveTransaction({ type: 'expense', amount: 50_000, categoryId: 'cat-food', walletId: 'gopay', date: todayKey(), time: '10:00', note: '' })
    expect(await archiveBlocker('gopay')).toBeNull()
    expect(await canDeleteWallet('gopay')).toBe(false)
  })

  it('blocks archiving a credit card with debt', async () => {
    const { archiveBlocker } = await import('./wallets')
    await db.wallets.add({ ...(await db.wallets.get(CASH_WALLET_ID))!, id: 'cc', type: 'credit' })
    await saveTransaction({ type: 'expense', amount: 10, categoryId: 'cat-food', walletId: 'cc', date: todayKey(), time: '10:00', note: '' })
    expect(await archiveBlocker('cc')).toMatch('utang')
  })
})

describe('category rules (FR-2.5, FR-2.6)', () => {
  it('protects "Lainnya"', async () => {
    const { archiveCategory, canDeleteCategory } = await import('./categories')
    await expect(archiveCategory('cat-other-expense', true)).rejects.toThrow('Lainnya')
    expect(await canDeleteCategory('cat-other-expense')).toBe(false)
  })

  it('deletes only unused categories', async () => {
    const { canDeleteCategory } = await import('./categories')
    expect(await canDeleteCategory('cat-food')).toBe(true)
    await expense(1)
    expect(await canDeleteCategory('cat-food')).toBe(false)
  })

  it('reorders within a kind', async () => {
    const { moveCategory } = await import('./categories')
    await moveCategory('cat-transport', 'expense', -1)
    const ordered = (await db.categories.where('kind').equals('expense').sortBy('order')).map((c) => c.id)
    expect(ordered.slice(0, 2)).toEqual(['cat-transport', 'cat-food'])
  })
})

describe('backup & restore (acceptance: backup → delete all → restore)', () => {
  it('restores identical data and balances', async () => {
    const { exportBackup, restoreBackup, deleteAllData } = await import('./backup')
    const { computeBalances } = await import('../lib/balance')
    await expense(25_000)
    await expense(10_000, '2026-01-15')
    await setSetting('monthStartDay', 25)
    await setSetting('pushClientId', 'device-a')
    const file = JSON.parse(JSON.stringify(await exportBackup()))
    expect(file.data.settings.some((r: { key: string }) => r.key === 'pushClientId')).toBe(false)

    const before = computeBalances(await db.wallets.toArray(), await db.transactions.toArray())
    await deleteAllData()
    expect(await db.transactions.count()).toBe(0)
    expect((await db.settings.get('pushClientId'))?.value).toBe('device-a') // this device stays registered

    await restoreBackup(file, 'replace')
    expect(await db.transactions.count()).toBe(2)
    expect(computeBalances(await db.wallets.toArray(), await db.transactions.toArray())).toEqual(before)
    expect((await db.settings.get('monthStartDay'))?.value).toBe(25)
    expect((await db.settings.get('pushClientId'))?.value).toBe('device-a')
  })

  it('merge skips existing ids and colliding budgets', async () => {
    const { exportBackup, restoreBackup } = await import('./backup')
    await expense(1)
    await db.budgets.add({ id: 'b1', categoryId: 'cat-food', period: '2026-09', amount: 5, autoRepeat: true, alerted80: false, alerted100: false })
    const file = JSON.parse(JSON.stringify(await exportBackup()))
    file.data.budgets.push({ id: 'b2', categoryId: 'cat-food', period: '2026-09', amount: 9, autoRepeat: true, alerted80: false, alerted100: false })
    file.data.transactions.push({ ...file.data.transactions[0], id: 'new-one' })
    await restoreBackup(file, 'merge')
    expect(await db.transactions.count()).toBe(2)
    expect(await db.budgets.count()).toBe(1)
  })
})
