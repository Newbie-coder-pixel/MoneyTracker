import { ChartNoAxesColumn, Ellipsis, History, House, Plus, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

type Tab = { to: string; label: string; icon: LucideIcon }

// Fixed order per PRD §5 — the mockup variant with a "Dompet" tab is not used.
const LEFT_TABS: Tab[] = [
  { to: '/', label: 'Beranda', icon: House },
  { to: '/riwayat', label: 'Riwayat', icon: History },
]
const RIGHT_TABS: Tab[] = [
  { to: '/statistik', label: 'Statistik', icon: ChartNoAxesColumn },
  { to: '/lainnya', label: 'Lainnya', icon: Ellipsis },
]

function TabLink({ to, label, icon: Icon }: Tab) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `group flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
          isActive ? 'font-semibold text-accent' : 'font-medium text-text-muted'
        }`
      }
    >
      <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
      {label}
      {/* The active tab is marked by an ink dot, not by colour alone. */}
      <span className="size-1 rounded-full bg-accent opacity-0 group-aria-[current=page]:opacity-100" aria-hidden="true" />
    </NavLink>
  )
}

export function BottomNav({ onAdd }: { onAdd: () => void }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center px-2">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Tambah transaksi"
            className="-mt-4 grid size-14 place-items-center rounded-full bg-primary text-on-primary active:opacity-90"
          >
            <Plus className="size-6" strokeWidth={2.25} />
          </button>
        </div>
        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  )
}
