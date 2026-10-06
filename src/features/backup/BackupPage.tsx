import { useLiveQuery } from 'dexie-react-hooks'
import { DatabaseBackup, FileSpreadsheet, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { downloadFile } from '../../components/download'
import { Field, inputClass } from '../../components/Pickers'
import { showToast } from '../../components/toast'
import { exportBackup } from '../../db/backup'
import { useCategoryMap, useWalletMap } from '../../db/hooks'
import { db } from '../../db/schema'
import { useSettings } from '../../db/settings'
import { backupFileName } from '../../lib/backup'
import { transactionsToCsv } from '../../lib/csv'
import { addDays, todayKey } from '../../lib/dates'
import { RestorePanel } from './RestorePanel'

export function BackupPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const categories = useCategoryMap()
  const wallets = useWalletMap()
  const today = todayKey()
  const [from, setFrom] = useState(params.get('from') ?? addDays(today, -29))
  const [to, setTo] = useState(params.get('to') ?? today)
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? false)
  const csvCount = useLiveQuery(() => db.transactions.where('date').between(from, to, true, true).count(), [from, to])

  const backup = async () => {
    const file = await exportBackup()
    downloadFile(backupFileName(), JSON.stringify(file), 'application/json')
    showToast('File backup diunduh. Simpan di tempat aman (Drive, email, laptop).', { duration: 5000 })
  }

  const exportCsv = async () => {
    const txs = await db.transactions.where('date').between(from, to, true, true).toArray()
    const csv = transactionsToCsv(txs, (id) => categories.get(id)?.name, (id) => wallets.get(id)?.name)
    downloadFile(`money-tracker-transaksi-${from}_${to}.csv`, csv, 'text/csv;charset=utf-8')
  }

  return (
    <>
      <AppHeader title="Backup & Ekspor" back />
      <main className="space-y-4 p-4">
        <p className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted p-4 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <span>
            Data hanya tersimpan di HP ini, tanpa akun atau cloud. Backup rutin agar data tidak hilang saat ganti HP atau cache terhapus.
            {persisted === false && ' Browser belum menjamin penyimpanan permanen, jadi backup makin penting.'}
          </span>
        </p>

        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <DatabaseBackup className="size-5" aria-hidden="true" /> Backup
          </h2>
          <p className="text-sm text-text-muted">
            {settings?.lastBackupAt
              ? `Terakhir: ${new Date(settings.lastBackupAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'Belum pernah backup.'}
          </p>
          <button type="button" onClick={() => void backup()} className="min-h-12 w-full rounded-full bg-primary font-semibold text-on-primary">
            Backup sekarang (.json)
          </button>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Pulihkan</h2>
          <RestorePanel onRestored={() => navigate('/', { replace: true })} />
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileSpreadsheet className="size-5" aria-hidden="true" /> Ekspor CSV
          </h2>
          <p className="text-sm text-text-muted">Untuk diolah di Excel atau Google Sheets.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari">
              <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Sampai">
              <input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <button
            type="button"
            disabled={!csvCount}
            onClick={() => void exportCsv()}
            className="min-h-12 w-full rounded-full border border-border font-semibold active:bg-surface-muted disabled:opacity-50"
          >
            {csvCount ? `Unduh CSV (${csvCount} transaksi)` : 'Tidak ada transaksi di rentang ini'}
          </button>
        </section>
      </main>
    </>
  )
}
