import { carryOverBudgets, evaluateThresholds } from '../lib/budget'
import { todayKey } from '../lib/dates'
import { monthPeriodOf, type Period } from '../lib/period'
import { categorySpent, flowTotals } from '../lib/stats'
import { newId } from './ids'
import { upsertReminder } from './reminders'
import { db } from './schema'
import { getSettings } from './settings'
import { TOTAL_BUDGET_ID, type Budget, type DateKey } from './types'

export interface BudgetAlert {
  budget: Budget
  name: string
  threshold: 80 | 100
  spent: number
}

export function transactionsInPeriod(period: Period) {
  return db.transactions.where('date').between(period.start, period.end, true, true).toArray()
}

/**
 * If a period has no budgets yet, copy autoRepeat budgets from the latest earlier
 * period that has any (PRD §6.2). No-op for future periods.
 */
export async function ensureBudgetsForPeriod(periodKey: string, currentKey: string): Promise<void> {
  if (periodKey > currentKey) return
  await db.transaction('rw', db.budgets, async () => {
    if ((await db.budgets.where('period').equals(periodKey).count()) > 0) return
    const latest = await db.budgets.where('period').below(periodKey).reverse().first()
    if (!latest) return
    const previous = await db.budgets.where('period').equals(latest.period).toArray()
    const copies = carryOverBudgets(previous, periodKey, newId)
    if (copies.length) await db.budgets.bulkAdd(copies)
  })
}

/** Creates or updates the budget of one category (or TOTAL_BUDGET_ID) in a period. */
export async function setBudget(period: Period, categoryId: string, amount: number): Promise<BudgetAlert[]> {
  await db.transaction('rw', db.budgets, async () => {
    const existing = await db.budgets.where('[period+categoryId]').equals([period.key, categoryId]).first()
    if (existing) {
      await db.budgets.update(existing.id, { amount })
    } else {
      // New budgets follow the period's repeat setting; default on (FR-6.2).
      const sibling = await db.budgets.where('period').equals(period.key).first()
      await db.budgets.add({ id: newId(), categoryId, period: period.key, amount, autoRepeat: sibling?.autoRepeat ?? true, alerted80: false, alerted100: false })
    }
  })
  return checkBudgets([period.start])
}

export async function removeBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
}

/** "Ulangi otomatis tiap bulan" applies to every budget of the period (FR-6.2). */
export async function setAutoRepeat(periodKey: string, autoRepeat: boolean): Promise<void> {
  await db.budgets.where('period').equals(periodKey).modify({ autoRepeat })
}

/** "Salin budget bulan lalu": copies all budgets of the previous period, regardless of autoRepeat. */
export async function copyPreviousBudgets(period: Period, previousKey: string): Promise<number> {
  const previous = await db.budgets.where('period').equals(previousKey).toArray()
  let copied = 0
  await db.transaction('rw', db.budgets, async () => {
    for (const b of previous) {
      const exists = await db.budgets.where('[period+categoryId]').equals([period.key, b.categoryId]).count()
      if (exists) continue
      await db.budgets.add({ ...b, id: newId(), period: period.key, alerted80: false, alerted100: false })
      copied++
    }
  })
  await checkBudgets([period.start])
  return copied
}

/** Budgets of the period with their current net spend. */
export async function budgetsWithSpend(period: Period): Promise<{ budget: Budget; spent: number }[]> {
  const [budgets, txs] = await Promise.all([db.budgets.where('period').equals(period.key).toArray(), transactionsInPeriod(period)])
  return budgets.map((budget) => ({
    budget,
    spent: budget.categoryId === TOTAL_BUDGET_ID ? flowTotals(txs, period).expense : categorySpent(txs, period, budget.categoryId),
  }))
}

/**
 * Re-evaluates the 80%/100% flags for every period touched by a change — both the
 * old and new date of an edited transaction (FR-6.7). Alerts are returned only for
 * the current period; past periods just get their flags corrected.
 */
export async function checkBudgets(dates: (DateKey | undefined)[]): Promise<BudgetAlert[]> {
  const { monthStartDay } = await getSettings()
  const current = monthPeriodOf(todayKey(), monthStartDay)
  const periods = new Map<string, Period>()
  for (const date of dates) {
    if (!date) continue
    const p = monthPeriodOf(date, monthStartDay)
    periods.set(p.key, p)
  }

  const alerts: BudgetAlert[] = []
  for (const period of periods.values()) {
    await ensureBudgetsForPeriod(period.key, current.key)
    for (const { budget, spent } of await budgetsWithSpend(period)) {
      const result = evaluateThresholds(budget, spent)
      if (result.alerted80 !== budget.alerted80 || result.alerted100 !== budget.alerted100) {
        await db.budgets.update(budget.id, { alerted80: result.alerted80, alerted100: result.alerted100 })
      }
      if (result.fire && period.key === current.key) {
        const name =
          budget.categoryId === TOTAL_BUDGET_ID
            ? 'bulanan'
            : ((await db.categories.get(budget.categoryId))?.name ?? 'Kategori')
        alerts.push({ budget, name, threshold: result.fire, spent })
      }
    }
  }

  for (const alert of alerts) {
    await upsertReminder({
      kind: 'budget',
      refId: `${alert.budget.id}:${alert.threshold}`,
      title: alert.threshold === 100 ? `Budget ${alert.name} terlampaui` : `Budget ${alert.name} hampir habis`,
      body: `Pemakaian sudah ${alert.threshold === 100 ? 'melewati' : 'mencapai'} ${alert.threshold}% dari anggaran bulan ini.`,
      dueAt: Date.now(),
      link: '/lainnya/budget',
    })
  }
  return alerts
}
