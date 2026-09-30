/** Largest amount accepted in any form (FR-1.8). */
export const MAX_AMOUNT = 999_999_999_999

const grouped = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

/** 25000 → "Rp 25.000", -20000 → "-Rp 20.000". */
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}Rp ${grouped.format(Math.abs(Math.round(amount)))}`
}

/** Expense-style signed display: "+Rp 6.500.000" / "-Rp 25.000". */
export function formatSignedRupiah(amount: number): string {
  if (amount > 0) return `+${formatRupiah(amount)}`
  return formatRupiah(amount)
}

/** Number part only: 25000 → "25.000". */
export function formatNumber(amount: number): string {
  return grouped.format(Math.round(amount))
}

/** Compact for chips and chart labels: 350000 → "350rb", 1500000 → "1,5jt". */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 })
  if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)}M`
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)}jt`
  if (abs >= 1_000) return `${sign}${fmt(abs / 1_000)}rb`
  return `${sign}${abs}`
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | 'back'

/** Applies one keypad press to an integer amount, never exceeding MAX_AMOUNT (FR-1.3). */
export function applyKeypad(amount: number, key: KeypadKey): number {
  if (key === 'back') return Math.floor(amount / 10)
  const next = Number(`${amount}${key}`)
  return next > MAX_AMOUNT ? amount : next
}

/** Quick-add buttons (+10rb, +50rb …), capped at MAX_AMOUNT. */
export function addCapped(amount: number, delta: number): number {
  return Math.min(MAX_AMOUNT, amount + delta)
}

/** Parses user-typed digits ("25.000", "Rp 25000") to an integer; NaN-safe (returns 0). */
export function parseAmountInput(text: string): number {
  const digits = text.replace(/\D/g, '')
  if (!digits) return 0
  return Math.min(MAX_AMOUNT, Number(digits))
}
