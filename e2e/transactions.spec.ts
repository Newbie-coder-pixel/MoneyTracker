import { expect, test } from '@playwright/test'
import { onboard, typeAmount } from './helpers.ts'

test('an expense in a new "Lainnya" category lowers the balance and survives a reload', async ({ page }) => {
  await onboard(page, 500_000)
  await expect(page.getByText('Rp 500.000').first()).toBeVisible()

  await page.getByRole('button', { name: 'Pengeluaran' }).click()
  await page.getByRole('button', { name: 'Lainnya', exact: true }).click()
  await page.getByPlaceholder('Misal: Kopi').fill('Kopi')
  await page.getByRole('radio', { name: 'coffee' }).click()
  await page.getByRole('button', { name: /Lanjut/ }).click()
  await typeAmount(page, 20_000)
  await page.getByRole('button', { name: /Lanjut/ }).click()
  await expect(page.getByText('Kopi')).toBeVisible()
  await page.getByRole('button', { name: /Simpan/ }).click()

  await expect(page.getByText('Tersimpan')).toBeVisible()
  await expect(page.getByText('Rp 480.000').first()).toBeVisible()
  await expect(page.getByText('-Rp 20.000').first()).toBeVisible()

  // IndexedDB keeps it across a reload (offline-first, no server).
  await page.reload()
  await expect(page.getByText('Rp 480.000').first()).toBeVisible()
  await expect(page.getByText('Kopi')).toBeVisible()
})

test('a typed name that already exists reuses that category', async ({ page }) => {
  await onboard(page, 100_000)
  await page.getByRole('button', { name: 'Pengeluaran' }).click()
  await page.getByRole('button', { name: 'Lainnya', exact: true }).click()
  await page.getByPlaceholder('Misal: Kopi').fill('kesehatan')
  await expect(page.getByText('Kategori "Kesehatan" sudah ada')).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Ikon' })).toHaveCount(0)
  await page.getByPlaceholder('Misal: Kopi').fill('lainnya')
  await expect(page.getByRole('button', { name: /Lanjut/ })).toBeDisabled()
})

test('deleting a transaction can be undone', async ({ page }) => {
  await onboard(page, 100_000)
  await page.getByRole('button', { name: 'Pengeluaran' }).click()
  await page.getByRole('button', { name: 'Kesehatan' }).click()
  await typeAmount(page, 30_000)
  await page.getByRole('button', { name: /Lanjut/ }).click()
  await page.getByRole('button', { name: /Simpan/ }).click()
  await expect(page.getByText('Rp 70.000').first()).toBeVisible()

  await page.getByText('Kesehatan').click()
  await page.getByRole('button', { name: /Hapus/ }).click()
  await expect(page.getByText('Transaksi dihapus')).toBeVisible()
  await expect(page.getByText('Rp 100.000').first()).toBeVisible()
  await page.getByRole('button', { name: 'Urungkan' }).click()
  await expect(page.getByText('Rp 70.000').first()).toBeVisible()
})
