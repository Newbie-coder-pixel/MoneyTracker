import type { AddKind } from './addSheetParam'

/**
 * Step flow of the transaction sheet: one step per screen (category → amount →
 * summary), kept out of the .tsx so it can be unit-tested.
 */
export type Step = 'category' | 'amount' | 'details'

/** A transfer has no category, so it starts at the amount. */
export const stepsFor = (kind: AddKind): Step[] => (kind === 'transfer' ? ['amount', 'details'] : ['category', 'amount', 'details'])

/** A new entry walks through the steps; an edit opens on the summary. */
export const firstStep = (kind: AddKind, editing: boolean): Step => (editing ? 'details' : stepsFor(kind)[0])

/** Once the summary has been seen, a correction goes straight back to it. */
export function nextStep(kind: AddKind, step: Step, reviewed: boolean): Step {
  if (reviewed) return 'details'
  const steps = stepsFor(kind)
  return steps[steps.indexOf(step) + 1] ?? 'details'
}

export interface CategoryChoice {
  /** The picked category is "Lainnya". */
  isOther: boolean
  isRefund: boolean
  /** Category of the transaction being edited, if any. */
  existingCategoryId?: string
  categoryId: string
}

/**
 * Picking "Lainnya" requires naming a new category. Refunds are exempt (they point at
 * an existing expense category), and so is an edit that leaves an old "Lainnya" untouched.
 */
export const needsNewCategory = ({ isOther, isRefund, existingCategoryId, categoryId }: CategoryChoice) =>
  isOther && !isRefund && existingCategoryId !== categoryId

/** Where the sheet goes after a category tap; "Lainnya" stays put until it's named. */
export function stepAfterCategory(choice: CategoryChoice, reviewed: boolean): Step {
  if (needsNewCategory(choice)) return 'category'
  return reviewed ? 'details' : 'amount'
}
