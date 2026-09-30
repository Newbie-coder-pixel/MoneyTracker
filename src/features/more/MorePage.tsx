import { ChevronRight, Settings, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'

type MenuItem = { to: string; label: string; description: string; icon: LucideIcon }

// Each stage adds its screen here (Budget, Transaksi Rutin, Dompet, Kategori, Backup & Ekspor).
// Don't list a screen before it exists — no dead buttons (PRD §9).
const DATA_AND_SECURITY: MenuItem[] = [
  { to: '/lainnya/pengaturan', label: 'Pengaturan Aplikasi', description: 'Tema tampilan', icon: Settings },
]

function MenuRow({ to, label, description, icon: Icon }: MenuItem) {
  return (
    <li>
      <Link to={to} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-surface-muted">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{label}</span>
          <span className="block truncate text-sm text-text-muted">{description}</span>
        </span>
        <ChevronRight className="size-5 text-text-muted" aria-hidden="true" />
      </Link>
    </li>
  )
}

export function MorePage() {
  return (
    <>
      <AppHeader title="Lainnya" />
      <main className="space-y-6 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span>Semua data tersimpan di HP ini, tanpa akun.</span>
        </div>

        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.12em] text-text-muted uppercase">Data & Keamanan</h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-surface">
            {DATA_AND_SECURITY.map((item) => (
              <MenuRow key={item.to} {...item} />
            ))}
          </ul>
        </section>

        <p className="text-center text-xs text-text-muted">Money Tracker v{__APP_VERSION__}</p>
      </main>
    </>
  )
}
