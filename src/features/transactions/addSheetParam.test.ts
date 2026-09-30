import { describe, expect, it } from 'vitest'
import { parseAddKind } from './addSheetParam'

describe('parseAddKind', () => {
  it('accepts the three sheet tabs', () => {
    expect(parseAddKind('expense')).toBe('expense')
    expect(parseAddKind('income')).toBe('income')
    expect(parseAddKind('transfer')).toBe('transfer')
  })

  it('treats anything else as closed', () => {
    expect(parseAddKind(null)).toBeNull()
    expect(parseAddKind('refund')).toBeNull()
    expect(parseAddKind('')).toBeNull()
  })
})
