import { describe, expect, it } from 'vitest'
import { creationOptions, fromBase64Url, isUserVerified, requestOptions, toBase64Url } from './biometric'

const authData = (flags: number) => {
  const bytes = new Uint8Array(37)
  bytes[32] = flags
  return bytes
}

describe('base64url', () => {
  it('round-trips every byte value without padding or URL-unsafe characters', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i)
    const text = toBase64Url(bytes)
    expect(text).not.toMatch(/[+/=]/)
    expect(fromBase64Url(text)).toEqual(bytes)
  })

  it('handles lengths that need padding', () => {
    for (const length of [0, 1, 2, 3, 16, 17]) {
      const bytes = Uint8Array.from({ length }, (_, i) => 250 + i)
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
    }
  })

  it('accepts an ArrayBuffer', () => {
    expect(toBase64Url(new Uint8Array([251, 255]).buffer)).toBe('-_8')
  })
})

describe('isUserVerified', () => {
  it('needs the user-verified flag, not just user presence', () => {
    expect(isUserVerified(authData(0x01))).toBe(false)
    expect(isUserVerified(authData(0x04))).toBe(true)
    expect(isUserVerified(authData(0x05))).toBe(true)
  })

  it('rejects data too short to hold the flags byte', () => {
    expect(isUserVerified(new Uint8Array(32).fill(0xff))).toBe(false)
  })
})

describe('WebAuthn options', () => {
  it('creates a platform credential that requires user verification', () => {
    const options = creationOptions(new Uint8Array(32), new Uint8Array(16))
    expect(options.authenticatorSelection).toMatchObject({ authenticatorAttachment: 'platform', userVerification: 'required' })
    expect(options.rp.id).toBeUndefined()
  })

  it('asks only for the stored credential, with user verification', () => {
    const id = new Uint8Array([1, 2, 3, 250])
    const options = requestOptions(new Uint8Array(32), toBase64Url(id))
    expect(options.userVerification).toBe('required')
    expect(options.allowCredentials).toHaveLength(1)
    expect(options.allowCredentials?.[0].id).toEqual(id)
  })
})
