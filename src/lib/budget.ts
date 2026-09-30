import type { Budget } from '../db/types'

export type BudgetLevel = 'safe' | 'warning' | 'over'

/** Safe < 80%, warning 80–99%, over ≥ 100% (FR-6.3). */
export function budgetLevel(spent: number, amount: number): BudgetLevel {
  if (amount <= 0) return spent > 0 ? 'over' : 'safe'
  const ratio = spent / amount
  if (ratio >= 1) return 'over'
  if (ratio >= 0.8) return 'warning'
  return 'safe'
}

export function budgetPercent(spent: number, amount: number): number {
  if (amount <= 0) return spent > 0 ? 100 : 0
  return Math.round((spent / amount) * 100)
}

/** max(0, budget − spent) ÷ days left including today (FR-6.5, PRD §6.2). */
export function perDayAllowance(amount: number, spent: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0
  return Math.floor(Math.max(0, amount - spent) / daysLeft)
}

export interface ThresholdResult {
  alerted80: boolean
  alerted100: boolean
  /** Threshold to announce now, if any. At most one per evaluation. */
  fire: 80 | 100 | null
}

/**
 * Each threshold fires once per category per period; the flag resets when usage
 * falls back below it (FR-6.6). A single jump past 100% announces only 100%.
 */
export function evaluateThresholds(budget: Pick<Budget, 'amount' | 'alerted80' | 'alerted100'>, spent: number): ThresholdResult {
  const ratio = budget.amount > 0 ? spent / budget.amount : 0
  const over80 = budget.amount > 0 && ratio >= 0.8
  const over100 = budget.amount > 0 && ratio >= 1
  let fire: ThresholdResult['fire'] = null
  if (over100 && !budget.alerted100) fire = 100
  else if (over80 && !budget.alerted80) fire = 80
  return { alerted80: over80, alerted100: over100, fire }
}

/** Budgets for a new period, copied from the previous one where autoRepeat is on (PRD §6.2). */
export function carryOverBudgets(previous: Budget[], period: string, newId: () => string): Budget[] {
  return previous
    .filter((b) => b.autoRepeat)
    .map((b) => ({ ...b, id: newId(), period, alerted80: false, alerted100: false }))
}
