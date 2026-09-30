import { FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { showToast } from '../../components/toast'
import { restoreBackup } from '../../db/backup'
import { checkBudgets } from '../../db/budgets'
import { processRecurring } from '../../db/recurring'
import { SCHEMA_VERSION } from '../../db/schema'
import { checkBackup, type BackupFile, type BackupTable } from '../../lib/backup'
import { todayKey } from '../../lib/dates'
import { syncPushOnOpen } from '../../pwa/push'
import { refreshReminders } from '../reminders/refresh'

const LABELS: Partial<Record<BackupTable, string>> = {
  transactions: 'transaksi',
  wallets: 'dompet',
  categories: 'kategori',
  budgets: 'budget',
  recurring: 'jadwal rutin',
}

/** Pick a backup file → validate → summary → choose mode → restore (FR-9.2). */
export function RestorePanel({ onRestored, allowMerge = true }: { onRestored: () => void; allowMerge?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ backup: BackupFile; counts: Record<BackupTable, number> } | null>(null)
  const [mode, setMode] = useState<'replace' | 'merge'>('replace')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (f: File | undefined) => {
    setError(null)
    setFile(null)
    if (!f) return
    try {
      const check = checkBackup(JSON.parse(await f.text()), SCHEMA_VERSION)
      if (check.ok) setFile({ backup: check.file, counts: check.counts })
      else setError(check.error)
    } catch {
      setError('File tidak bisa dibaca. Pastikan ini file backup .json dari Money Tracker.')
    }
  }

  const restore = async () => {
    if (!file) return
    setBusy(true)
    try {
      await restoreBackup(file.backup, mode)
      await processRecurring()
      await checkBudgets([todayKey()])
      await refreshReminders()
      // The restored data has new due dates; re-sync this device's push registration (FR-8.11).
      void syncPushOnOpen()
      showToast('Data berhasil dipulihkan')
      onRestored()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label="Pilih file backup" />
      <button type="button" onClick={() => input.current?.click()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-muted font-semibold">
        <FileUp className="size-5" aria-hidden="true" /> Pilih file backup
      </button>
      {error && (
        <p role="alert" className="rounded-2xl bg-expense-soft px-4 py-3 text-sm text-expense">
          {error}
        </p>
      )}
      {file && (
        <div className="space-y-3 rounded-2xl bg-surface-muted p-4 text-sm">
          <p>
            Backup tanggal <b>{new Date(file.backup.exportedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</b>
          </p>
          <ul className="grid grid-cols-2 gap-1 text-text-muted">
            {(Object.keys(LABELS) as BackupTable[]).map((t) => (
              <li key={t}>
                <b className="text-text">{file.counts[t]}</b> {LABELS[t]}
              </li>
            ))}
          </ul>
          {allowMerge && (
            <fieldset className="space-y-2">
              <legend className="font-medium">Cara memulihkan</legend>
              {(
                [
                  ['replace', 'Ganti semua data', 'Data di HP ini dihapus dan diganti isi backup.'],
                  ['merge', 'Gabungkan', 'Tambahkan isi backup; data yang sudah ada dilewati.'],
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value} className="flex items-start gap-2">
                  <input type="radio" name="restore-mode" checked={mode === value} onChange={() => setMode(value)} className="mt-1 size-5 accent-primary" />
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs text-text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <button type="button" disabled={busy} onClick={() => void restore()} className="min-h-12 w-full rounded-2xl bg-primary font-semibold text-on-primary disabled:opacity-60">
            {mode === 'replace' ? 'Ganti data dengan backup' : 'Gabungkan data'}
          </button>
        </div>
      )}
    </div>
  )
}
