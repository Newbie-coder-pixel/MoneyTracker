export type ThemePreference = 'light' | 'dark' | 'system'

/**
 * localStorage key for the theme. The inline script in index.html reads it before
 * first paint. Stage 2 moves settings to Dexie, but this mirror stays because
 * IndexedDB is async and too slow to prevent a flash of the wrong theme.
 */
export const THEME_STORAGE_KEY = 'mt-theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light'
  return pref
}
