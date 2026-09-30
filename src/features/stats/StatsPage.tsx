import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChartSpline, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { EmptyState } from '../../components/EmptyState'
import { useCategoryMap, useWallets } from '../../db/hooks'
import { db } from '../../db/schema'
import { getSettings } from '../../db/settings'
import { TOTAL_BUDGET_ID } from '../../db/types'
import { todayKey } from '../../lib/dates'
import {
  monthPeriodByKey,
  monthPeriodLabel,
  monthPeriodOf,
  periodLength,
  shiftMonthKey,
  shiftWeek,
  weekPeriodLabel,
  weekPeriodOf,
} from '../../lib/period'
import { MonthlyView } from './MonthlyView'
import { WeeklyView } from './WeeklyView'

type View = 'week' | 'month'

/** Lazy-loaded route: Recharts stays out of the initial bundle (PRD §7.1). */
export default function StatsPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'month' ? 'month' : 'week'
  const walletId = params.get('wallet') || undefined
  const categories = useCategoryMap()
  const wallets = useWallets()

  const data = useLiveQuery(async () => {
    const [settings, txs, budgets] = await Promise.all([getSettings(), db.transactions.toArray(), db.budgets.toArray()])
    return { settings, txs, budgets }
  })

  const today = todayKey()
  const startDay = data?.settings.monthStartDay ?? 1
  const currentWeek = weekPeriodOf(today)
  const currentMonth = monthPeriodOf(today, startDay)
  const periodParam = params.get('p')
  const period =
    view === 'week'
      ? periodParam && /^\d{4}-\d{2}-\d{2}$/.test(periodParam)
        ? weekPeriodOf(periodParam)
        : currentWeek
      : periodParam && /^\d{4}-\d{2}$/.test(periodParam)
        ? monthPeriodByKey(periodParam, startDay)
        : currentMonth
  const isCurrent = period.key === (view === 'week' ? currentWeek.key : currentMonth.key)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  const shift = (delta: number) =>
    update({ p: view === 'week' ? shiftWeek(period, delta).key : shiftMonthKey(period.key, delta) })

  // Swipe left/right to change period (FR-5.3).
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1)
  }

  // Daily target on the weekly chart = total budget ÷ days in its month (PRD §9).
  const monthOfWeek = monthPeriodOf(period.start, startDay)
  const totalBudget = data?.budgets.find((b) => b.period === monthOfWeek.key && b.categoryId === TOTAL_BUDGET_ID)
  const dailyTarget = totalBudget ? Math.round(totalBudget.amount / periodLength(monthOfWeek)) : null

  const exportParams = new URLSearchParams({ from: period.start, to: period.end })

  return (
    <>
      <AppHeader
        title="Statistik"
        actions={
          <Link to={`/lainnya/backup?${exportParams}`} aria-label="Export CSV periode ini" className="grid size-11 place-items-center rounded-full hover:bg-surface-muted">
            <Download className="size-6" aria-hidden="true" />
          </Link>
        }
      />
      <main className="space-y-4 p-4" onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={onTouchEnd}>
        <div role="group" aria-label="Tampilan" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1">
          {(['week', 'month'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => update({ view: v, p: null })}
              className={`min-h-11 rounded-xl font-semibold ${view === v ? 'bg-primary text-on-primary' : 'text-text-muted'}`}
            >
              {v === 'week' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-2xl bg-surface p-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Periode sebelumnya" className="grid size-11 place-items-center rounded-xl">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <p className="flex flex-1 items-center justify-center gap-2 text-center text-sm font-semibold" aria-live="polite">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {view === 'week' ? weekPeriodLabel(period) : monthPeriodLabel(period)}
          </p>
          <button type="button" onClick={() => shift(1)} aria-label="Periode berikutnya" className="grid size-11 place-items-center rounded-xl">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrent && (
            <button type="button" onClick={() => update({ p: null })} className="min-h-11 rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary">
              {view === 'week' ? 'Minggu ini' : 'Bulan ini'}
            </button>
          )}
          <label className="ml-auto flex min-h-11 items-center gap-2 text-sm">
            <span className="text-text-muted">Dompet</span>
            <select
              value={walletId ?? ''}
              onChange={(e) => update({ wallet: e.target.value || null })}
              className="min-h-11 rounded-xl bg-surface px-3 font-semibold"
            >
              <option value="">Semua</option>
              {wallets?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!data ? null : data.txs.length === 0 ? (
          <EmptyState icon={ChartSpline} message="Belum ada transaksi. Ketuk + untuk mencatat yang pertama." />
        ) : view === 'week' ? (
          <WeeklyView period={period} txs={data.txs} categories={categories} walletId={walletId} dailyTarget={dailyTarget} />
        ) : (
          <MonthlyView period={period} startDay={startDay} txs={data.txs} budgets={data.budgets} categories={categories} walletId={walletId} />
        )}
      </main>
    </>
  )
}
