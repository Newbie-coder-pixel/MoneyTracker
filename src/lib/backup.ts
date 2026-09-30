import type { SettingRow } from '../db/types'
import { toDateKey } from './dates'

export const BACKUP_APP_ID = 'money-tracker'
export const BACKUP_REMINDER_DAYS = 30

export const BACKUP_TABLES = [
  'wallets',
  'categories',
  'transactions',
  'budgets',
  'recurring',
  'recurringOccurrences',
  'reminders',
  'settings',
] as const
export type BackupTable = (typeof BACKUP_TABLES)[number]

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  data: Record<BackupTable, unknown[]>
}

/** Device-specific settings that must not travel to another device via backup. */
export const DEVICE_ONLY_SETTINGS = new Set(['pushEnabled', 'pushClientId', 'pushEndpoint', 'backupSnoozedUntil', 'installHintDismissed'])

export function backupFileName(date = new Date()): string {
  return `money-tracker-backup-${toDateKey(date)}.json`
}

export function stripDeviceSettings(rows: SettingRow[]): SettingRow[] {
  return rows.filter((r) => !DEVICE_ONLY_SETTINGS.has(r.key))
}

export type BackupCheck =
  | { ok: true; file: BackupFile; counts: Record<BackupTable, number> }
  | { ok: false; error: string }

/** Validates a parsed backup before restore (FR-9.2). */
export function checkBackup(json: unknown, currentSchemaVersion: number): BackupCheck {
  if (!json || typeof json !== 'object') return { ok: false, error: 'File bukan backup Money Tracker.' }
  const file = json as Partial<BackupFile>
  if (file.app !== BACKUP_APP_ID || typeof file.schemaVersion !== 'number' || !file.data)
    return { ok: false, error: 'File bukan backup Money Tracker.' }
  if (file.schemaVersion > currentSchemaVersion)
    return { ok: false, error: 'Backup dibuat oleh versi aplikasi yang lebih baru. Muat ulang aplikasi lalu coba lagi.' }
  const counts = {} as Record<BackupTable, number>
  for (const table of BACKUP_TABLES) {
    const rows = file.data[table]
    if (!Array.isArray(rows)) return { ok: false, error: `Backup rusak: tabel ${table} tidak ada.` }
    counts[table] = rows.length
  }
  return { ok: true, file: file as BackupFile, counts }
}

/** Days since the last backup (or since install when never backed up); null if unknown. */
export function backupAgeDays(lastBackupAt: number | undefined, installedAt: number | undefined, now: number): number | null {
  const since = lastBackupAt ?? installedAt
  if (since === undefined) return null
  return Math.floor((now - since) / 86_400_000)
}
