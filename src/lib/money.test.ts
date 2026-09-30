import { describe, expect, it } from 'vitest'
import { addCapped, applyKeypad, formatCompact, formatRupiah, formatSignedRupiah, MAX_AMOUNT, parseAmountInput } from './money'

describe('formatRupiah', () => {
  it('uses Indonesian grouping', () => {
    expect(formatRupiah(25000)).toBe('Rp 25.000')
    expect(formatRupiah(4250000)).toBe('Rp 4.250.000')
    expect(formatRupiah(0)).toBe('Rp 0')
  })
  it('puts the sign before Rp', () => {
    expect(formatRupiah(-20000)).toBe('-Rp 20.000')
    expect(formatSignedRupiah(6500000)).toBe('+Rp 6.500.000')
  })
})

describe('formatCompact', () => {
  it('abbreviates rb/jt', () => {
    expect(formatCompact(350000)).toBe('350rb')
    expect(formatCompact(1500000)).toBe('1,5jt')
    expect(formatCompact(900)).toBe('900')
  })
})

describe('keypad', () => {
  it('appends digits and 000', () => {
    let amount = 0
    for (const key of ['2', '5', '000'] as const) amount = applyKeypad(amount, key)
    expect(amount).toBe(25000)
  })
  it('backspaces', () => {
    expect(applyKeypad(25000, 'back')).toBe(2500)
    expect(applyKeypad(5, 'back')).toBe(0)
  })
  it('never exceeds the maximum', () => {
    expect(applyKeypad(MAX_AMOUNT, '9')).toBe(MAX_AMOUNT)
    expect(applyKeypad(999_999_999, '000')).toBe(999_999_999_000)
    expect(addCapped(MAX_AMOUNT - 5, 100_000)).toBe(MAX_AMOUNT)
  })
  it('ignores leading zeros', () => {
    expect(applyKeypad(0, '000')).toBe(0)
  })
})

describe('parseAmountInput', () => {
  it('strips formatting', () => {
    expect(parseAmountInput('Rp 25.000')).toBe(25000)
    expect(parseAmountInput('')).toBe(0)
  })
})
