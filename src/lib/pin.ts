/**
 * PIN lock (FR-10.2): stored as SHA-256(salt + pin). It only hides the screen; the
 * data itself is not encrypted, so a simple hash is enough.
 */

export const PIN_MIN = 4
export const PIN_MAX = 6
/** Lock again after this long in the background. */
export const AUTO_LOCK_MS = 60_000

const toHex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)))
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)))
}

export async function verifyPin(pin: string, salt: string, hash: string): Promise<boolean> {
  return (await hashPin(pin, salt)) === hash
}

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin)
