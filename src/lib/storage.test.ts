import { describe, expect, it } from 'vitest'
import { storageStatus } from './storage'

const facts = { supported: true, persisted: false, standalone: false, ios: false }

describe('storageStatus (FR-9.5)', () => {
  it('is safe once the browser granted persistence', () => {
    expect(storageStatus({ ...facts, persisted: true })).toMatchObject({ safe: true, canRequest: false })
    expect(storageStatus({ ...facts, persisted: true, ios: true })).toMatchObject({ safe: true })
  })

  it('warns about Safari\'s 7-day eviction when not installed on iOS', () => {
    expect(storageStatus({ ...facts, ios: true }).hint).toContain('7 hari')
    expect(storageStatus({ ...facts, ios: true, standalone: true }).hint).not.toContain('7 hari')
  })

  it('only offers the request button where the API exists', () => {
    expect(storageStatus(facts).canRequest).toBe(true)
    expect(storageStatus({ ...facts, supported: false })).toMatchObject({ safe: false, canRequest: false })
  })
})
