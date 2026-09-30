import { ChevronRight, Eye, EyeOff, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { IconBadge } from '../../components/IconBadge'
import { useBalances } from '../../db/hooks'
import type { Wallet } from '../../db/types'
import { formatRupiah } from '../../lib/money'
import { WALLET_TYPES } from './walletTypes'

export function WalletsPage() {
  const data = useBalances()
  const [showArchived, setShowArchived] = useState(false)
  if (!data) return <AppHeader title="Dompet" back />

  const active = data.wallets.filter((w) => !w.archived)
  const archived = data.wallets.filter((w) => w.archived)
  const groups = [...new Set(WALLET_TYPES.map((t) => t.group))].map((group) => ({
    group,
    wallets: active.filter((w) => WALLET_TYPES.find((t) => t.type === w.type)?.group === group),
  }))
  const assets = active.filter((w) => w.includeInTotal).reduce((s, w) => s + Math.max(0, data.balances.get(w.id) ?? 0), 0)

  return (
    <>
      <AppHeader
        title="Dompet"
        back
        actions={
          <Link to="/lainnya/dompet/baru" className="flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary">
            <Plus className="size-4" aria-hidden="true" /> Tambah
          </Link>
        }
      />
      <main className="space-y-5 p-4">
        <section className="rounded-3xl bg-gradient-to-br from-hero-from to-hero-to p-5 text-on-hero">
          <p className="text-sm opacity-90">Saldo total</p>
          <p className="text-3xl font-bold tabular-nums">{formatRupiah(data.total)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white/15 px-3 py-1">Aset {formatRupiah(assets)}</span>
            {data.creditDebt > 0 && <span className="rounded-full bg-white/15 px-3 py-1">Utang {formatRupiah(data.creditDebt)}</span>}
          </div>
        </section>

        {groups.map(
          ({ group, wallets }) =>
            wallets.length > 0 && (
              <section key={group}>
                <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.12em] text-text-muted uppercase">{group}</h2>
                <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-surface">
                  {wallets.map((w) => (
                    <WalletRow key={w.id} wallet={w} balance={data.balances.get(w.id) ?? 0} />
                  ))}
                </ul>
              </section>
            ),
        )}

        {archived.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-text-muted"
            >
              {showArchived ? <EyeOff className="size-4" /> : <Eye className="size-4" />} Diarsipkan ({archived.length})
            </button>
            {showArchived && (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-surface opacity-80">
                {archived.map((w) => (
                  <WalletRow key={w.id} wallet={w} balance={data.balances.get(w.id) ?? 0} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </>
  )
}

function WalletRow({ wallet, balance }: { wallet: Wallet; balance: number }) {
  const negative = balance < 0 && wallet.type !== 'credit'
  return (
    <li className="flex items-center">
      <Link to={`/lainnya/dompet/${wallet.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-surface-muted">
        <IconBadge icon={wallet.icon} color={wallet.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{wallet.name}</span>
          <span className="block text-xs text-text-muted">
            {!wallet.includeInTotal ? 'Tidak dihitung di saldo total' : negative ? 'Saldo minus' : wallet.type === 'credit' && balance < 0 ? 'Utang' : ''}
          </span>
        </span>
        <span className={`shrink-0 font-semibold tabular-nums ${negative || (wallet.type === 'credit' && balance < 0) ? 'text-expense' : ''}`}>
          {formatRupiah(balance)}
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
      </Link>
    </li>
  )
}
