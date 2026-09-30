import { BACKUP_APP_ID, BACKUP_TABLES, DEVICE_ONLY_SETTINGS, stripDeviceSettings, type BackupFile, type BackupTable } from '../lib/backup'
import { db, SCHEMA_VERSION } from './schema'
import { ensureSeeded } from './seed'
import { setSetting } from './settings'
import type { SettingRow } from './types'

/** Full JSON backup of every table (FR-9.1); device-only settings are left out. */
export async function exportBackup(now = new Date()): Promise<BackupFile> {
  const data = {} as Record<BackupTable, unknown[]>
  await db.transaction('r', db.tables, async () => {
    for (const table of BACKUP_TABLES) data[table] = await db.table(table).toArray()
  })
  data.settings = stripDeviceSettings(data.settings as SettingRow[])
  await setSetting('lastBackupAt', now.getTime())
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data }
}

async function deviceSettings(): Promise<SettingRow[]> {
  return (await db.settings.toArray()).filter((r) => DEVICE_ONLY_SETTINGS.has(r.key))
}

/**
 * Restore (FR-9.2). "replace" wipes everything first; "merge" only adds rows whose id
 * (or unique compound key) isn't present yet. This device's push registration is kept.
 */
export async function restoreBackup(file: BackupFile, mode: 'replace' | 'merge'): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const keep = await deviceSettings()
    if (mode === 'replace') {
      for (const table of BACKUP_TABLES) await db.table(table).clear()
      for (const table of BACKUP_TABLES) {
        const rows = table === 'settings' ? stripDeviceSettings(file.data.settings as SettingRow[]) : file.data[table]
        await db.table(table).bulkPut(rows)
      }
      await db.settings.bulkPut(keep)
      return
    }

    for (const table of BACKUP_TABLES) {
      const t = db.table(table)
      const rows = (table === 'settings' ? stripDeviceSettings(file.data.settings as SettingRow[]) : file.data[table]) as Record<string, unknown>[]
      const pk = t.schema.primKey.keyPath as string
      const existingKeys = new Set((await t.toCollection().primaryKeys()).map(String))
      let fresh = rows.filter((r) => !existingKeys.has(String(r[pk])))
      // Unique compound indexes must not collide either.
      if (table === 'budgets') {
        const taken = new Set((await db.budgets.toArray()).map((b) => `${b.period}|${b.categoryId}`))
        fresh = fresh.filter((r) => !taken.has(`${r.period}|${r.categoryId}`))
      }
      if (table === 'recurringOccurrences') {
        const taken = new Set((await db.recurringOccurrences.toArray()).map((o) => `${o.recurringId}|${o.date}`))
        fresh = fresh.filter((r) => !taken.has(`${r.recurringId}|${r.date}`))
      }
      if (fresh.length) await t.bulkAdd(fresh)
    }
  })
  // A backup from before onboarding finished shouldn't send the user back to it.
  await setSetting('onboarded', true)
}

/** "Hapus semua data" (FR-10.3): back to a fresh install, onboarding included. Push stays registered. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    const keep = await deviceSettings()
    for (const table of db.tables) await table.clear()
    await db.settings.bulkPut(keep.filter((r) => r.key !== 'installHintDismissed'))
  })
  await ensureSeeded()
}
