import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker at startup — independent of any screen, so offline
 * support and push work from the very first visit (including during onboarding).
 */

let needRefresh = false
const listeners = new Set<() => void>()

export const updateServiceWorker = registerSW({
  onNeedRefresh() {
    needRefresh = true
    listeners.forEach((l) => l())
  },
  onRegisteredSW(_url, registration) {
    // Installed PWAs can stay open for days; check for a new version hourly.
    if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
  },
})

/** True once a new version is installed and waiting (FR-10.6). */
export function useNeedRefresh(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => needRefresh,
  )
}
