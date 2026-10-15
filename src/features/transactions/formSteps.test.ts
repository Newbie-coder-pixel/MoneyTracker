import { describe, expect, it } from 'vitest'
import { firstStep, needsNewCategory, nextStep, stepAfterCategory, stepsFor } from './formSteps'

describe('transaction sheet steps', () => {
  it('skips the category step for a transfer', () => {
    expect(stepsFor('expense')).toEqual(['category', 'amount', 'details'])
    expect(stepsFor('income')).toEqual(['category', 'amount', 'details'])
    expect(stepsFor('transfer')).toEqual(['amount', 'details'])
  })

  it('opens an edit on the summary', () => {
    expect(firstStep('expense', false)).toBe('category')
    expect(firstStep('transfer', false)).toBe('amount')
    expect(firstStep('expense', true)).toBe('details')
  })

  it('walks forward, and returns straight to the summary once it was seen', () => {
    expect(nextStep('expense', 'category', false)).toBe('amount')
    expect(nextStep('expense', 'amount', false)).toBe('details')
    expect(nextStep('transfer', 'amount', false)).toBe('details')
    expect(nextStep('expense', 'category', true)).toBe('details')
  })
})

describe('"Lainnya" needs a name', () => {
  const other = { isOther: true, isRefund: false, categoryId: 'cat-other' }

  it('is required for a new entry on "Lainnya" only', () => {
    expect(needsNewCategory(other)).toBe(true)
    expect(needsNewCategory({ ...other, isOther: false })).toBe(false)
  })

  it('exempts refunds and edits that keep their old "Lainnya"', () => {
    expect(needsNewCategory({ ...other, isRefund: true })).toBe(false)
    expect(needsNewCategory({ ...other, existingCategoryId: 'cat-other' })).toBe(false)
    expect(needsNewCategory({ ...other, existingCategoryId: 'cat-food' })).toBe(true)
  })

  it('keeps the sheet on the category step until named', () => {
    expect(stepAfterCategory(other, false)).toBe('category')
    expect(stepAfterCategory({ ...other, isOther: false }, false)).toBe('amount')
    expect(stepAfterCategory({ ...other, isOther: false }, true)).toBe('details')
  })
})
