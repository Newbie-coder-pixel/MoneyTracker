import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, newSalt, verifyPin } from './pin'

describe('pin', () => {
  it('hashes with a salt and verifies', async () => {
    const salt = newSalt()
    const hash = await hashPin('1234', salt)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await verifyPin('1234', salt, hash)).toBe(true)
    expect(await verifyPin('4321', salt, hash)).toBe(false)
    expect(await hashPin('1234', newSalt())).not.toBe(hash)
  })

  it('accepts 4–6 digits only', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('1234567')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })
})
