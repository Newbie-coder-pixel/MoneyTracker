/**
 * Biometric unlock (Face ID / fingerprint) via a WebAuthn platform credential. Like the
 * PIN it only hides the screen: there is no server, so the assertion's signature is not
 * verified. We only check that the device reports a successful user verification.
 */

export const BIOMETRIC_TIMEOUT_MS = 60_000

/** Authenticator data layout: 32-byte RP ID hash, then one flags byte. */
const FLAGS_OFFSET = 32
const FLAG_USER_VERIFIED = 0x04

export function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  let binary = ''
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** True when the authenticator says the user passed biometrics or the device passcode. */
export function isUserVerified(authenticatorData: ArrayBuffer | Uint8Array): boolean {
  const bytes = new Uint8Array(authenticatorData)
  return bytes.length > FLAGS_OFFSET && (bytes[FLAGS_OFFSET] & FLAG_USER_VERIFIED) !== 0
}

/** Options for creating the credential on this device's built-in authenticator. */
export function creationOptions(challenge: Uint8Array<ArrayBuffer>, userId: Uint8Array<ArrayBuffer>): PublicKeyCredentialCreationOptions {
  return {
    challenge,
    // No rp.id: the browser uses the current domain, so the credential is tied to it.
    rp: { name: 'Money Tracker' },
    user: { id: userId, name: 'Money Tracker', displayName: 'Money Tracker' },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    attestation: 'none',
    timeout: BIOMETRIC_TIMEOUT_MS,
  }
}

/** Options for asking the stored credential to verify the user. */
export function requestOptions(challenge: Uint8Array<ArrayBuffer>, credentialId: string): PublicKeyCredentialRequestOptions {
  return {
    challenge,
    allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId), transports: ['internal'] }],
    userVerification: 'required',
    timeout: BIOMETRIC_TIMEOUT_MS,
  }
}
