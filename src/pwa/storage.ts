import { isIOS, isStandalone } from './install-prompt'
import type { StorageFacts } from '../lib/storage'

export async function readStorageFacts(): Promise<StorageFacts> {
  const supported = typeof navigator.storage?.persisted === 'function'
  const persisted = supported ? await navigator.storage.persisted().catch(() => false) : false
  return { supported, persisted, standalone: isStandalone(), ios: isIOS() }
}

/** Asks for persistent storage (FR-9.5); resolves to whether it was granted. */
export async function requestPersistentStorage(): Promise<boolean> {
  return (await navigator.storage?.persist?.().catch(() => false)) ?? false
}
