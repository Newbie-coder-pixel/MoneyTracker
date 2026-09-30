/**
 * Fired after a transaction is saved by the user (not by a recurring schedule).
 * The push module listens to tell the server "already logged today" (FR-8.3)
 * without the data layer importing push code.
 */
type Listener = () => void
const manualSaveListeners = new Set<Listener>()

export function onManualTransactionSaved(listener: Listener): () => void {
  manualSaveListeners.add(listener)
  return () => manualSaveListeners.delete(listener)
}

export function emitManualTransactionSaved(): void {
  manualSaveListeners.forEach((l) => l())
}
