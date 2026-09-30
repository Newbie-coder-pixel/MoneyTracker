import { useSyncExternalStore } from 'react'
import { AUTO_LOCK_MS } from '../../lib/pin'

// Starts locked; the app only honours it when a PIN is set.
let locked = true
let hiddenAt: number | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function unlock() {
  locked = false
  emit()
}

export function lock() {
  locked = true
  emit()
}

// Auto-lock after a minute in the background (FR-10.2).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now()
  else if (hiddenAt !== null && Date.now() - hiddenAt >= AUTO_LOCK_MS) lock()
})

export function useLocked(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => locked,
  )
}
