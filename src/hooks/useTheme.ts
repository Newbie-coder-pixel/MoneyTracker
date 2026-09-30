import { useSyncExternalStore } from 'react'
import { isThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from '../lib/theme'

// Module-level store so every useTheme() caller shares one preference and there is
// exactly one system-theme listener.

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

let preference = readPreference()

function applyTheme() {
  const dark = resolveTheme(preference, darkQuery.matches) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

darkQuery.addEventListener('change', applyTheme)

export function setThemePreference(pref: ThemePreference) {
  preference = pref
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref)
  } catch {
    // Storage blocked (private mode); the theme still applies for this session.
  }
  applyTheme()
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => listeners.delete(notify)
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, () => preference)
  return { preference: current, setPreference: setThemePreference }
}
