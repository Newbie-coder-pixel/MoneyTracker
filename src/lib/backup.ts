import type { SettingRow } from '../db/types'
import { toDateKey } from './dates'
import { MAX_AMOUNT } from './money'

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
export const DEVICE_ONLY_SETTINGS = new Set(['pushEnabled', 'pushClientId', 'pushEndpoint', 'backupSnoozedUntil', 'installHintDismissed', 'biometricCredentialId'])

export function backupFileName(date = new Date()): string {
  return `money-tracker-backup-${toDateKey(date)}.json`
}

export function stripDeviceSettings(rows: SettingRow[]): SettingRow[] {
  return rows.filter((r) => !DEVICE_ONLY_SETTINGS.has(r.key))
}

export type BackupCheck =
  | { ok: true; file: BackupFile; counts: Record<BackupTable, number> }
  | { ok: false; error: string }

const TABLE_LABELS: Record<BackupTable, string> = {
  wallets: 'dompet',
  categories: 'kategori',
  transactions: 'transaksi',
  budgets: 'budget',
  recurring: 'transaksi rutin',
  recurringOccurrences: 'jadwal rutin',
  reminders: 'pengingat',
  settings: 'pengaturan',
}

type Row = Record<string, unknown>

const isDateKey = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isTimeKey = (v: unknown) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)
const isText = (v: unknown) => typeof v === 'string' && v.length > 0
const isRupiah = (v: unknown) => Number.isSafeInteger(v) && Math.abs(v as number) <= MAX_AMOUNT
const optionalText = (v: unknown) => v === undefined || typeof v === 'string'
const isOneOf = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v)

/**
 * The fields the app's calculations rely on, per table. Returns the first broken field
 * name, or null. Optional fields are only checked when present, so older backups pass.
 */
const ROW_CHECKS: Record<BackupTable, (r: Row) => string | null> = {
  wallets: (r) =>
    !isText(r.id) ? 'id'
    : typeof r.name !== 'string' ? 'nama'
    : !isOneOf(r.type, ['cash', 'ewallet', 'bank', 'credit']) ? 'jenis'
    : !isRupiah(r.initialBalance) ? 'saldo awal'
    : !isDateKey(r.initialDate) ? 'tanggal awal'
    : null,
  categories: (r) =>
    !isText(r.id) ? 'id' : typeof r.name !== 'string' ? 'nama' : !isOneOf(r.kind, ['expense', 'income']) ? 'jenis' : null,
  transactions: (r) =>
    !isText(r.id) ? 'id'
    : !isOneOf(r.type, ['expense', 'income', 'transfer', 'adjustment', 'refund']) ? 'jenis'
    : !isRupiah(r.amount) || (r.type !== 'adjustment' && (r.amount as number) <= 0) ? 'nominal'
    : !isText(r.walletId) ? 'dompet'
    : !optionalText(r.categoryId) || !optionalText(r.toWalletId) ? 'kategori/dompet tujuan'
    : !isDateKey(r.date) ? 'tanggal'
    : !isTimeKey(r.time) ? 'jam'
    : null,
  budgets: (r) =>
    !isText(r.id) ? 'id'
    : !isText(r.categoryId) ? 'kategori'
    : typeof r.period !== 'string' || !/^\d{4}-\d{2}$/.test(r.period) ? 'periode'
    : !isRupiah(r.amount) || (r.amount as number) < 0 ? 'nominal'
    : null,
  recurring: (r) => {
    if (!isText(r.id)) return 'id'
    const t = r.template as Row | undefined
    if (!t || typeof t !== 'object') return 'template'
    if (!isRupiah(t.amount) || (t.amount as number) <= 0) return 'nominal'
    if (!isText(t.walletId)) return 'dompet'
    return !isDateKey(r.startDate) ? 'tanggal mulai' : null
  },
  recurringOccurrences: (r) =>
    !isText(r.id) ? 'id' : !isText(r.recurringId) ? 'jadwal' : !isDateKey(r.date) ? 'tanggal' : null,
  reminders: (r) => (!isText(r.id) ? 'id' : null),
  settings: (r) => (!isText(r.key) ? 'key' : null),
}

/** First invalid row of a table as an Indonesian message, or null. */
function checkRows(table: BackupTable, rows: unknown[]): string | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const field = row && typeof row === 'object' && !Array.isArray(row) ? ROW_CHECKS[table](row as Row) : 'isi'
    if (field) return `Backup rusak: ${TABLE_LABELS[table]} baris ${i + 1} tidak valid (${field}). Data kamu tidak diubah.`
  }
  return null
}

/**
 * Validates a parsed backup before restore (FR-9.2), down to the fields each row needs,
 * so a damaged file is rejected before anything on the device is touched.
 */
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
    const broken = checkRows(table, rows)
    if (broken) return { ok: false, error: broken }
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
