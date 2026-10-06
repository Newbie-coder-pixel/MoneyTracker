import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronRight, Eye, EyeOff, ReceiptText, Repeat } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'
import { useCategoryMap, useWalletMap } from '../../db/hooks'
import { db } from '../../db/schema'
import { getSettings, setSetting } from '../../db/settings'
import { compareNewestFirst } from '../../db/transactions'
import { TOTAL_BUDGET_ID } from '../../db/types'
import { computeBalances, totalBalance, totalCreditDebt } from '../../lib/balance'
import { upcomingBills } from '../../lib/bills'
import { budgetLevel, budgetPercent, perDayAllowance } from '../../lib/budget'
import { formatDayLong, formatDayShort, todayKey } from '../../lib/dates'
import { formatCompact, formatRupiah } from '../../lib/money'
import { daysRemaining, monthPeriodOf } from '../../lib/period'
import { categorySpent, flowTotals } from '../../lib/stats'
import { InstallBanner } from '../../pwa/InstallBanner'
import { BackupBanner } from '../backup/BackupBanner'
import { ReminderBell } from '../reminders/ReminderBell'
import { TransactionRow } from '../transactions/TransactionRow'
import { useTransactionSheet } from '../transactions/useTransactionSheet'

const LEVEL_BAR = { safe: 'bg-accent', warning: 'bg-warning', over: 'bg-expense' }

function useHomeData() {
  const raw = useLiveQuery(async () => {
    const [settings, wallets, txs, recurring, occurrences, budgets] = await Promise.all([
      getSettings(),
      db.wallets.toArray(),
      db.transactions.toArray(),
      db.recurring.toArray(),
      db.recurringOccurrences.toArray(),
      db.budgets.toArray(),
    ])
    return { settings, wallets: wallets.sort((a, b) => a.order - b.order), txs, recurring, occurrences, budgets }
  })

  return useMemo(() => {
    if (!raw) return undefined
    const { settings, wallets, txs, recurring, occurrences, budgets } = raw
    const today = todayKey()
    const period = monthPeriodOf(today, settings.monthStartDay)
    const balances = computeBalances(wallets, txs)
    const todayFlow = flowTotals(txs, { key: today, start: today, end: today })
    const monthFlow = flowTotals(txs, period)

    // Total budget if set; otherwise the sum of category budgets vs spend in those categories.
    const periodBudgets = budgets.filter((b) => b.period === period.key)
    const total = periodBudgets.find((b) => b.categoryId === TOTAL_BUDGET_ID)
    const budget = total
      ? { amount: total.amount, spent: monthFlow.expense }
      : periodBudgets.length
        ? {
            amount: periodBudgets.reduce((s, b) => s + b.amount, 0),
            spent: periodBudgets.reduce((s, b) => s + categorySpent(txs, period, b.categoryId), 0),
          }
        : null

    const handled = new Set(occurrences.filter((o) => o.status !== 'pending').map((o) => `${o.recurringId}:${o.date}`))
    return {
      settings,
      wallets: wallets.filter((w) => !w.archived),
      balances,
      total: totalBalance(wallets, balances),
      creditDebt: totalCreditDebt(wallets, balances),
      todayFlow,
      todayCount: txs.filter((t) => t.date === today && (t.type === 'expense' || t.type === 'income')).length,
      monthFlow,
      budget,
      daysLeft: daysRemaining(period, today),
      bills: upcomingBills({ recurring, handled, cards: wallets, txs }, today, 7),
      pending: occurrences.filter((o) => o.status === 'pending').length,
      recent: [...txs].sort(compareNewestFirst).slice(0, 5),
      hasAny: txs.length > 0,
    }
  }, [raw])
}

export function HomePage() {
  const data = useHomeData()
  const categories = useCategoryMap()
  const walletMap = useWalletMap()
  const sheet = useTransactionSheet()

  if (!data) return <AppHeader title="Beranda" />
  const hidden = data.settings.hideBalance
  const money = (n: number) => (hidden ? 'Rp ••••••' : formatRupiah(n))

  return (
    <>
      {/* No greeting or name: the app has no account (PRD §9). */}
      <AppHeader title="Beranda" eyebrow={formatDayLong(todayKey())} actions={<ReminderBell />} />
      <main className="space-y-4 p-4">
        <section aria-label="Saldo">
          <div className="flex items-center gap-1">
            <p className="label-caps">Saldo total</p>
            <button
              type="button"
              onClick={() => void setSetting('hideBalance', !hidden)}
              aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              className="-my-3 grid size-11 place-items-center rounded-full text-text-muted"
            >
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-[2rem] leading-10 font-bold tracking-tight">{money(data.total)}</p>
          {data.creditDebt > 0 && (
            <p className="mt-1 text-sm text-text-muted">
              Utang kartu kredit <span className="font-semibold text-expense">{money(data.creditDebt)}</span>
            </p>
          )}
          <div className="mt-3 flex items-baseline justify-between">
            <h2 className="label-caps">Dompet</h2>
            <Link to="/lainnya/dompet" className="-my-3 flex min-h-11 items-center text-[13px] font-semibold text-accent">
              {data.wallets.length} akun aktif
            </Link>
          </div>
          <ul className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            {data.wallets.map((w) => {
              const balance = data.balances.get(w.id) ?? 0
              return (
                <li key={w.id} className="shrink-0">
                  <Link to={`/lainnya/dompet/${w.id}`} className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[13px]">
                    <span className="size-2 rounded-full" style={{ background: w.color }} aria-hidden="true" />
                    <span className="text-text-muted">{w.name}</span>
                    <span className={`font-semibold ${balance < 0 && w.type !== 'credit' ? 'text-expense' : ''}`}>{hidden ? '••••' : formatRupiah(balance)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <QuickAction icon={<ArrowDownLeft className="size-4" />} label="Pemasukan" onClick={() => sheet.openAdd('income')} />
          <QuickAction icon={<ArrowUpRight className="size-4" />} label="Pengeluaran" onClick={() => sheet.openAdd('expense')} />
          <QuickAction icon={<ArrowLeftRight className="size-4" />} label="Transfer" onClick={() => sheet.openAdd('transfer')} />
        </div>

        <BackupBanner />
        <InstallBanner />

        <section className="card grid grid-cols-2 divide-x divide-border py-4">
          <div className="px-4">
            <p className="label-caps">Hari ini</p>
            <p className="mt-1 truncate text-lg font-semibold text-expense">-{formatRupiah(data.todayFlow.expense)}</p>
            <p className="text-xs text-text-muted">{data.todayCount} transaksi</p>
          </div>
          <div className="px-4">
            <p className="label-caps">Bulan ini</p>
            <p className="mt-1 truncate text-lg font-semibold text-expense">-{formatRupiah(data.monthFlow.expense)}</p>
            <p className="text-xs text-text-muted">Masuk +{formatCompact(data.monthFlow.income)}</p>
          </div>
        </section>

        {data.budget ? (
          <Link to="/lainnya/budget" className="card block p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="label-caps">Anggaran bulanan</span>
              <span className="text-right text-[13px]">
                <span className={`font-semibold ${data.budget.spent >= data.budget.amount ? 'text-expense' : ''}`}>{formatRupiah(data.budget.spent)}</span>
                <span className="text-text-muted"> / {formatRupiah(data.budget.amount)}</span>
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className={`h-full rounded-full ${LEVEL_BAR[budgetLevel(data.budget.spent, data.budget.amount)]}`}
                style={{ width: `${Math.min(100, budgetPercent(data.budget.spent, data.budget.amount))}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs text-text-muted">
              <span>
                Sisa per hari <b className="font-semibold text-text">{formatRupiah(perDayAllowance(data.budget.amount, data.budget.spent, data.daysLeft))}</b>
              </span>
              <span>
                {budgetPercent(data.budget.spent, data.budget.amount)}% terpakai · sisa {data.daysLeft} hari
              </span>
            </div>
          </Link>
        ) : (
          <Link to="/lainnya/budget" className="card flex min-h-12 items-center justify-between px-4 text-sm">
            <span className="text-text-muted">Belum ada budget bulan ini</span>
            <span className="font-semibold text-accent">Atur budget</span>
          </Link>
        )}

        {data.pending > 0 && (
          <Link to="/lainnya/rutin" className="flex min-h-12 items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4">
            <Repeat className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <span className="flex-1 text-sm font-medium">{data.pending} transaksi rutin perlu dikonfirmasi</span>
            <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
          </Link>
        )}

        {data.bills.length > 0 && (
          <section>
            <SectionHead title="Tagihan 7 hari ke depan" to="/lainnya/rutin" link="Semua" />
            <ul className="card divide-y divide-border">
              {data.bills.map((bill) => (
                <li key={bill.key} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{bill.name}</span>
                    <span className="block text-[13px] text-text-muted">{formatDayShort(bill.date)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-semibold">{formatRupiah(bill.amount)}</span>
                    <span className="block text-xs text-text-muted">{bill.kind === 'credit' ? 'Kartu kredit' : 'Rutin'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <SectionHead title="Transaksi terakhir" to={data.hasAny ? '/riwayat' : undefined} link="Semua" />
          {data.recent.length ? (
            <ul className="card divide-y divide-border overflow-hidden">
              {data.recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} categories={categories} wallets={walletMap} onOpen={sheet.openEdit} showDate />
              ))}
            </ul>
          ) : (
            <EmptyState icon={ReceiptText} message="Belum ada transaksi. Ketuk + untuk mencatat yang pertama." />
          )}
        </section>
      </main>
    </>
  )
}

function SectionHead({ title, to, link }: { title: string; to?: string; link: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="label-caps">{title}</h2>
      {to && (
        <Link to={to} className="-my-3 flex min-h-11 items-center text-[13px] font-semibold text-accent">
          {link}
        </Link>
      )}
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-2 text-[13px] font-semibold active:bg-surface-muted"
    >
      {icon}
      {label}
    </button>
  )
}
