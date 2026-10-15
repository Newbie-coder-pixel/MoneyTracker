import { expect, test } from '@playwright/test'
import { onboard } from './helpers.ts'

test('a damaged backup is rejected before anything is restored', async ({ page }) => {
  await onboard(page, 250_000)
  await page.goto('/lainnya/backup')
  const broken = {
    app: 'money-tracker',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      wallets: [{ id: 'w', name: 'X', type: 'cash', initialBalance: 0, initialDate: '2026-01-01' }],
      categories: [],
      transactions: [{ id: 't', type: 'expense', amount: '20000', walletId: 'w', date: '2026-10-01', time: '10:00', note: '' }],
      budgets: [],
      recurring: [],
      recurringOccurrences: [],
      reminders: [],
      settings: [],
    },
  }
  await page.getByLabel('Pilih file backup').setInputFiles({ name: 'rusak.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(broken)) })
  await expect(page.getByText('transaksi baris 1 tidak valid (nominal)')).toBeVisible()

  await page.goto('/')
  await expect(page.getByText('Rp 250.000').first()).toBeVisible()
})
