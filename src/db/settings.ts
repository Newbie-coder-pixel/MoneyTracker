import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './schema'
import type { SettingKey, SettingRow, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  monthStartDay: 1,
  hideBalance: false,
  dailyReminderTime: '21:00',
  onboarded: false,
  pushEnabled: false,
}

export function settingsFromRows(rows: SettingRow[]): Settings {
  const settings = { ...DEFAULT_SETTINGS } as Record<string, unknown>
  for (const row of rows) settings[row.key] = row.value
  return settings as unknown as Settings
}

export async function getSettings(): Promise<Settings> {
  return settingsFromRows(await db.settings.toArray())
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  if (value === undefined) await db.settings.delete(key)
  else await db.settings.put({ key, value } as SettingRow)
}

/** Live settings with defaults applied; undefined while the first read is in flight. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings)
}
