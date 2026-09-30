import { ChartSpline, House, LayoutGrid, Plus, ReceiptText, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

type Tab = { to: string; label: string; icon: LucideIcon }

// Fixed order per PRD §5 — the mockup variant with a "Dompet" tab is not used.
const LEFT_TABS: Tab[] = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/riwayat', label: 'Riwayat', icon: ReceiptText },
]
const RIGHT_TABS: Tab[] = [
  { to: '/statistik', label: 'Statistik', icon: ChartSpline },
  { to: '/lainnya', label: 'Lainnya', icon: LayoutGrid },
]

function TabLink({ to, label, icon: Icon }: Tab) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ${
          isActive ? 'text-primary' : 'text-text-muted'
        }`
      }
    >
      <Icon className="size-6" aria-hidden="true" />
      {label}
    </NavLink>
  )
}

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md rounded-t-3xl border-t border-border/60 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgb(0_0_0/0.06)]"
    >
      <div className="flex items-end px-2">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Tambah transaksi"
            className="-mt-7 mb-2 grid size-16 place-items-center rounded-full bg-primary text-on-primary shadow-lg shadow-primary/30 transition-transform active:scale-95 motion-reduce:transition-none"
          >
            <Plus className="size-8" strokeWidth={2.5} />
          </button>
        </div>
        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  )
}
