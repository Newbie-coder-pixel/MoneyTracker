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
        <section className="card p-5">
          <p className="label-caps">Saldo total</p>
          <p className="mt-1 text-[2rem] leading-10 font-bold tracking-tight">{formatRupiah(data.total)}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-[13px] text-text-muted">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-income" aria-hidden="true" />
              Aset <b className="font-semibold text-text">{formatRupiah(assets)}</b>
            </span>
            {data.creditDebt > 0 && (
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-expense" aria-hidden="true" />
                Utang <b className="font-semibold text-expense">{formatRupiah(data.creditDebt)}</b>
              </span>
            )}
          </div>
        </section>

        {groups.map(
          ({ group, wallets }) =>
            wallets.length > 0 && (
              <section key={group}>
                <h2 className="mb-2 label-caps">{group}</h2>
                <ul className="card divide-y divide-border overflow-hidden">
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
              <ul className="card divide-y divide-border overflow-hidden opacity-80">
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
      <Link to={`/lainnya/dompet/${wallet.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 active:bg-surface-muted">
        <IconBadge icon={wallet.icon} color={wallet.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{wallet.name}</span>
          <span className="block text-xs text-text-muted">
            {!wallet.includeInTotal ? 'Tidak dihitung di saldo total' : negative ? 'Saldo minus' : wallet.type === 'credit' && balance < 0 ? 'Utang' : ''}
          </span>
        </span>
        <span className={`shrink-0 font-semibold tabular-nums ${negative || (wallet.type === 'credit' && balance < 0) ? 'text-expense' : ''}`}>
          {formatRupiah(balance)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      </Link>
    </li>
  )
}
