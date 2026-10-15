import { expect, type Page } from '@playwright/test'

/** Runs onboarding with one cash wallet holding `cash` Rupiah and lands on Beranda. */
export async function onboard(page: Page, cash: number) {
  await page.goto('/')
  await page.getByRole('button', { name: /Mulai/ }).click()
  await page.locator('input[inputmode="numeric"]').first().fill(String(cash))
  await page.getByLabel('Tambah E-wallet').uncheck()
  await page.getByLabel('Tambah Rekening bank').uncheck()
  await page.getByRole('button', { name: /Lanjut ke pengingat/ }).click()
  await page.getByRole('button', { name: /Lewati/ }).click()
  await expect(page.getByText('Transaksi terakhir')).toBeVisible()
}

/** Types an amount on the sheet's keypad. */
export async function typeAmount(page: Page, amount: number) {
  for (const digit of String(amount)) await page.getByRole('button', { name: digit, exact: true }).click()
}

