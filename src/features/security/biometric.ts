import { creationOptions, isUserVerified, requestOptions, toBase64Url } from '../../lib/biometric'

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))

/** Whether this device and browser have a built-in authenticator (Face ID, Touch ID, fingerprint, screen lock). */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return window.isSecureContext && typeof PublicKeyCredential !== 'undefined' && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

/** Creates the credential and returns its id to store, or null if the user cancelled or it failed. */
export async function registerBiometric(): Promise<string | null> {
  try {
    const credential = await navigator.credentials.create({ publicKey: creationOptions(randomBytes(32), randomBytes(16)) })
    return credential instanceof PublicKeyCredential ? toBase64Url(credential.rawId) : null
  } catch {
    return null
  }
}

// Browsers allow one WebAuthn request at a time, so concurrent callers share it.
let pending: Promise<boolean> | null = null

/** Shows the system biometric prompt; false if the user cancelled, failed or it isn't supported. */
export function verifyBiometric(credentialId: string): Promise<boolean> {
  pending ??= (async () => {
    try {
      const assertion = await navigator.credentials.get({ publicKey: requestOptions(randomBytes(32), credentialId) })
      if (!(assertion instanceof PublicKeyCredential) || toBase64Url(assertion.rawId) !== credentialId) return false
      return isUserVerified((assertion.response as AuthenticatorAssertionResponse).authenticatorData)
    } catch {
      return false
    }
  })().finally(() => {
    pending = null
  })
  return pending
}
