import { useLiveQuery } from 'dexie-react-hooks'
import { DatabaseBackup, X } from 'lucide-react'
import { Link } from 'react-router'
import { db } from '../../db/schema'
import { getSettings, setSetting } from '../../db/settings'
import { backupAgeDays, BACKUP_REMINDER_DAYS } from '../../lib/backup'

const SNOOZE_DAYS = 7

/** Shown on Beranda when the last backup is older than 30 days (FR-9.4). */
export function BackupBanner() {
  const state = useLiveQuery(async () => {
    const [settings, wallets, txCount] = await Promise.all([getSettings(), db.wallets.toArray(), db.transactions.count()])
    // Never backed up: count from the first wallet's creation (≈ install time).
    const installedAt = wallets.length ? Math.min(...wallets.map((w) => w.createdAt)) : undefined
    const now = Date.now()
    const age = backupAgeDays(settings.lastBackupAt, installedAt, now)
    const show =
      txCount > 0 && age !== null && age > BACKUP_REMINDER_DAYS && !(settings.backupSnoozedUntil && settings.backupSnoozedUntil > now)
    return { show, age, lastBackupAt: settings.lastBackupAt }
  })
  if (!state?.show) return null
  const { age } = state

  return (
    <section className="flex items-start gap-3 rounded-3xl bg-expense-soft p-4">
      <DatabaseBackup className="mt-0.5 size-6 shrink-0 text-expense" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">{state.lastBackupAt ? `Backup terakhir ${age} hari lalu` : 'Data belum pernah di-backup'}</p>
        <p className="text-sm text-text-muted">Simpan file backup agar data tidak hilang saat ganti HP atau cache terhapus.</p>
        <Link to="/lainnya/backup" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">
          Backup sekarang
        </Link>
      </div>
      <button
        type="button"
        aria-label="Ingatkan nanti"
        onClick={() => void setSetting('backupSnoozedUntil', Date.now() + SNOOZE_DAYS * 86_400_000)}
        className="-mt-2 -mr-2 grid size-11 place-items-center rounded-full"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </section>
  )
}
