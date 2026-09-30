import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, CalendarClock, ChevronRight, CircleMinus, CirclePlus, Eye, EyeOff, Lightbulb, ReceiptText, Repeat } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'
import { IconBadge } from '../../components/IconBadge'
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

const LEVEL_BAR = { safe: 'bg-primary', warning: 'bg-warning', over: 'bg-expense' }

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
      <AppHeader title="Beranda" actions={<ReminderBell />} />
      <main className="space-y-4 p-4">
        <section>
          <p className="text-sm text-text-muted">{formatDayLong(todayKey())}</p>
          {/* No name in the greeting: the app has no account (PRD §9). */}
          <p className="text-2xl font-bold">Halo 👋</p>
        </section>

        <BackupBanner />
        <InstallBanner />

        <section className="rounded-3xl bg-gradient-to-br from-hero-from to-hero-to p-5 text-on-hero shadow-lg shadow-black/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium opacity-90">Saldo total</p>
            <button
              type="button"
              onClick={() => void setSetting('hideBalance', !hidden)}
              aria-label={hidden ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-white/10"
            >
              {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
          <p className="text-3xl font-bold tabular-nums">{money(data.total)}</p>
          {data.creditDebt > 0 && <p className="mt-1 text-sm opacity-90">Utang kartu kredit {money(data.creditDebt)}</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 font-semibold">
            <QuickAction icon={<CirclePlus className="size-5" />} label="Pemasukan" onClick={() => sheet.openAdd('income')} />
            <QuickAction icon={<CircleMinus className="size-5" />} label="Pengeluaran" onClick={() => sheet.openAdd('expense')} />
            <QuickAction icon={<ArrowLeftRight className="size-5" />} label="Transfer" onClick={() => sheet.openAdd('transfer')} />
          </div>
        </section>

        <section aria-label="Dompet">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="text-xs font-semibold tracking-[0.12em] text-text-muted uppercase">Dompet</h2>
            <Link to="/lainnya/dompet" className="text-sm font-semibold text-primary">
              {data.wallets.length} akun aktif
            </Link>
          </div>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {data.wallets.map((w) => {
              const balance = data.balances.get(w.id) ?? 0
              return (
                <li key={w.id} className="shrink-0">
                  <Link to={`/lainnya/dompet/${w.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface py-2 pr-4 pl-2">
                    <IconBadge icon={w.icon} color={w.color} size="sm" />
                    <span>
                      <span className="block text-xs text-text-muted">{w.name}</span>
                      <span className={`block font-bold tabular-nums ${balance < 0 && w.type !== 'credit' ? 'text-expense' : ''}`}>
                        {hidden ? '••••' : formatRupiah(balance)}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="space-y-4 rounded-3xl bg-surface p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface-muted p-3">
              <p className="text-sm text-text-muted">Hari ini</p>
              <p className="text-lg font-bold text-expense tabular-nums">-{formatRupiah(data.todayFlow.expense)}</p>
              <p className="text-xs text-text-muted">{data.todayCount} transaksi</p>
            </div>
            <div className="rounded-2xl bg-surface-muted p-3">
              <p className="text-sm text-text-muted">Bulan ini</p>
              <p className="text-lg font-bold text-expense tabular-nums">-{formatRupiah(data.monthFlow.expense)}</p>
              <p className="text-xs text-text-muted">Masuk +{formatCompact(data.monthFlow.income)}</p>
            </div>
          </div>
          {data.budget ? (
            <Link to="/lainnya/budget" className="block space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Anggaran bulanan</span>
                <span className={`font-semibold ${data.budget.spent >= data.budget.amount ? 'text-expense' : 'text-text'}`}>
                  {budgetPercent(data.budget.spent, data.budget.amount)}% terpakai
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className={`h-full rounded-full ${LEVEL_BAR[budgetLevel(data.budget.spent, data.budget.amount)]}`}
                  style={{ width: `${Math.min(100, budgetPercent(data.budget.spent, data.budget.amount))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-text">
                  <Lightbulb className="size-3.5" aria-hidden="true" /> Sisa per hari{' '}
                  <b>{formatRupiah(perDayAllowance(data.budget.amount, data.budget.spent, data.daysLeft))}</b>
                </span>
                <span>Sisa {data.daysLeft} hari</span>
              </div>
            </Link>
          ) : (
            <Link to="/lainnya/budget" className="flex min-h-11 items-center justify-between rounded-2xl bg-surface-muted px-4 text-sm">
              <span>Belum ada budget bulan ini</span>
              <span className="font-semibold text-primary">Atur budget</span>
            </Link>
          )}
        </section>

        {data.pending > 0 && (
          <Link to="/lainnya/rutin" className="flex min-h-14 items-center gap-3 rounded-3xl bg-warning-soft px-4">
            <Repeat className="size-5 text-warning" aria-hidden="true" />
            <span className="flex-1 text-sm font-semibold">{data.pending} transaksi rutin perlu dikonfirmasi</span>
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        )}

        {data.bills.length > 0 && (
          <section className="rounded-3xl bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarClock className="size-5 text-primary" aria-hidden="true" /> Tagihan 7 hari ke depan
              </h2>
              <Link to="/lainnya/rutin" className="text-sm font-semibold text-primary">
                Semua
              </Link>
            </div>
            <ul className="space-y-2">
              {data.bills.map((bill) => (
                <li key={bill.key} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{bill.name}</span>
                    <span className="text-xs text-text-muted">
                      {bill.kind === 'credit' ? 'Jatuh tempo kartu kredit' : 'Jatuh tempo'} · {formatDayShort(bill.date)}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{formatRupiah(bill.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-3xl bg-surface py-2">
          <div className="flex items-center justify-between px-4 py-2">
            <h2 className="text-lg font-semibold">Transaksi terakhir</h2>
            {data.hasAny && (
              <Link to="/riwayat" className="text-sm font-semibold text-primary">
                Lihat riwayat
              </Link>
            )}
          </div>
          {data.recent.length ? (
            <ul>
              {data.recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} categories={categories} wallets={walletMap} onOpen={sheet.openEdit} showTime={false} />
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

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 px-1 text-xs hover:bg-white/25">
      {icon}
      <span>{label}</span>
    </button>
  )
}
