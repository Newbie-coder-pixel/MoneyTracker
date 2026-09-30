import { describe, expect, it } from 'vitest'
import type { Budget } from '../db/types'
import { budgetLevel, carryOverBudgets, evaluateThresholds, perDayAllowance } from './budget'

describe('budgetLevel', () => {
  it('uses the 80% / 100% bands', () => {
    expect(budgetLevel(799_999, 1_000_000)).toBe('safe')
    expect(budgetLevel(800_000, 1_000_000)).toBe('warning')
    expect(budgetLevel(999_999, 1_000_000)).toBe('warning')
    expect(budgetLevel(1_000_000, 1_000_000)).toBe('over')
  })
})

describe('evaluateThresholds (acceptance: Rp 1.000.000 budget)', () => {
  it('fires exactly once at 800k and once at 1M', () => {
    let budget = { amount: 1_000_000, alerted80: false, alerted100: false }
    const fired: (number | null)[] = []
    for (const spent of [500_000, 800_000, 850_000, 1_000_000, 1_200_000]) {
      const r = evaluateThresholds(budget, spent)
      fired.push(r.fire)
      budget = { ...budget, alerted80: r.alerted80, alerted100: r.alerted100 }
    }
    expect(fired).toEqual([null, 80, null, 100, null])
  })

  it('re-arms when usage drops below a threshold (FR-6.6)', () => {
    const after = evaluateThresholds({ amount: 1_000_000, alerted80: true, alerted100: true }, 700_000)
    expect(after).toEqual({ alerted80: false, alerted100: false, fire: null })
    expect(evaluateThresholds({ amount: 1_000_000, ...after }, 810_000).fire).toBe(80)
  })

  it('announces only 100% on a single big jump', () => {
    const r = evaluateThresholds({ amount: 1_000_000, alerted80: false, alerted100: false }, 1_500_000)
    expect(r).toEqual({ alerted80: true, alerted100: true, fire: 100 })
  })
})

describe('perDayAllowance', () => {
  it('divides the remainder by the days left', () => {
    expect(perDayAllowance(3_000_000, 2_140_000, 9)).toBe(95_555)
    expect(perDayAllowance(100, 200, 5)).toBe(0)
    expect(perDayAllowance(100, 0, 0)).toBe(0)
  })
})

describe('carryOverBudgets', () => {
  it('copies autoRepeat budgets with fresh flags', () => {
    const prev: Budget[] = [
      { id: 'a', categoryId: 'food', period: '2026-09', amount: 1, autoRepeat: true, alerted80: true, alerted100: true },
      { id: 'b', categoryId: 'fun', period: '2026-09', amount: 2, autoRepeat: false, alerted80: false, alerted100: false },
    ]
    const next = carryOverBudgets(prev, '2026-10', () => 'new')
    expect(next).toEqual([
      { id: 'new', categoryId: 'food', period: '2026-10', amount: 1, autoRepeat: true, alerted80: false, alerted100: false },
    ])
  })
})
