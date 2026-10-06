import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, CalendarClock, ChevronRight, DatabaseBackup, PieChart, Settings, Shapes, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { db } from '../../db/schema'
import { getSettings } from '../../db/settings'
import { backupAgeDays, BACKUP_REMINDER_DAYS } from '../../lib/backup'
import { ReminderBell } from '../reminders/ReminderBell'

type MenuItem = { to: string; label: string; description: string; icon: LucideIcon; badge?: string; dot?: boolean }

function MenuRow({ to, label, description, icon: Icon, badge, dot }: MenuItem) {
  return (
    <li>
      <Link to={to} className="flex min-h-16 items-center gap-4 px-4 py-3 active:bg-surface-muted">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-[10px] border border-border bg-surface-muted">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          {dot && (
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-expense ring-2 ring-surface">
              <span className="sr-only">Perlu perhatian</span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            {label}
            {badge && <span className="rounded-full bg-expense-soft px-2 py-0.5 text-[11px] font-semibold text-expense">{badge}</span>}
          </span>
          <span className="block truncate text-[13px] text-text-muted">{description}</span>
        </span>
        <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
      </Link>
    </li>
  )
}

function Group({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <section>
      <h2 className="mb-2 label-caps">{title}</h2>
      <ul className="card divide-y divide-border overflow-hidden">
        {items.map((item) => (
          <MenuRow key={item.to} {...item} />
        ))}
      </ul>
    </section>
  )
}

export function MorePage() {
  const status = useLiveQuery(async () => {
    const [pending, settings, wallets] = await Promise.all([db.recurringOccurrences.where('status').equals('pending').count(), getSettings(), db.wallets.toArray()])
    const installedAt = wallets.length ? Math.min(...wallets.map((w) => w.createdAt)) : undefined
    const age = backupAgeDays(settings.lastBackupAt, installedAt, Date.now())
    return { pending, backupStale: age !== null && age > BACKUP_REMINDER_DAYS }
  })

  return (
    <>
      <AppHeader title="Lainnya" eyebrow="Menu" actions={<ReminderBell />} />
      <main className="space-y-6 p-4">
        <Group
          title="Pengelolaan keuangan"
          items={[
            { to: '/lainnya/budget', label: 'Budget', description: 'Batas pengeluaran bulanan per kategori', icon: PieChart },
            {
              to: '/lainnya/rutin',
              label: 'Transaksi Rutin',
              description: 'Kos, langganan, cicilan',
              icon: CalendarClock,
              badge: status?.pending ? `${status.pending} perlu cek` : undefined,
            },
            { to: '/lainnya/dompet', label: 'Dompet', description: 'Cash, e-wallet, bank, kartu kredit', icon: Wallet },
            { to: '/lainnya/kategori', label: 'Kategori', description: 'Tambah, ubah, urutkan, arsipkan', icon: Shapes },
          ]}
        />
        <Group
          title="Data & keamanan"
          items={[
            { to: '/lainnya/backup', label: 'Backup & Ekspor', description: 'File backup JSON dan ekspor CSV', icon: DatabaseBackup, dot: status?.backupStale },
            { to: '/pengingat', label: 'Pengingat', description: 'Notifikasi harian dan jatuh tempo', icon: Bell },
            { to: '/lainnya/pengaturan', label: 'Pengaturan', description: 'Tanggal mulai bulan, tema, PIN', icon: Settings },
          ]}
        />

        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3 text-[13px] text-text-muted">
          <ShieldCheck className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <span>Semua data tersimpan di HP ini, tanpa akun.</span>
        </div>

        <p className="label-caps text-center">Money Tracker · versi {__APP_VERSION__}</p>
      </main>
    </>
  )
}
