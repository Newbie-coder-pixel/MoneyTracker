import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category, Transaction } from '../../db/types'
import { eachDay, formatDayLong, formatWeekdayShort, todayKey } from '../../lib/dates'
import { formatCompact, formatRupiah } from '../../lib/money'
import { percentChange, periodLength, shiftWeek, type Period } from '../../lib/period'
import { dailyFlows, elapsedDays, expenseByCategory, flowTotals, peakDay } from '../../lib/stats'
import { CategoryBreakdown } from './CategoryBreakdown'
import { Card, ChangeBadge, ChartTooltip, Legend } from './chartParts'
import { reducedMotion } from './motion'
import { useChartColors } from './useChartColors'

type Props = {
  period: Period
  txs: Transaction[]
  categories: Map<string, Category>
  walletId?: string
  /** Total monthly budget ÷ days in that month, if a total budget exists (PRD §9). */
  dailyTarget: number | null
}

export function WeeklyView({ period, txs, categories, walletId, dailyTarget }: Props) {
  const colors = useChartColors()
  const [showIncome, setShowIncome] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)

  const data = useMemo(() => {
    const filter = { walletId }
    const days = dailyFlows(txs, eachDay(period.start, period.end), filter).map((d) => ({ ...d, label: formatWeekdayShort(d.date) }))
    const totals = flowTotals(txs, period, filter)
    const previous = flowTotals(txs, shiftWeek(period, -1), filter)
    const elapsed = elapsedDays(period, todayKey())
    return {
      days,
      total: totals.expense,
      average: elapsed ? Math.round(totals.expense / elapsed) : 0,
      peak: peakDay(days),
      change: percentChange(totals.expense, previous.expense),
      categories: expenseByCategory(txs, period, filter),
    }
  }, [txs, period, walletId])

  const pick = selected !== null ? data.days[selected] : null
  const drillDay = (date: string) => {
    const params = new URLSearchParams({ from: date, to: date })
    if (walletId) params.set('wallet', walletId)
    return `/riwayat?${params}`
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-text-muted uppercase">Total pengeluaran</p>
            <p className="text-3xl font-bold tabular-nums">{formatRupiah(data.total)}</p>
          </div>
          <ChangeBadge change={data.change} suffix="" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-surface-muted p-3 text-sm">
          <div>
            <p className="text-xs text-text-muted">Rata-rata</p>
            <p className="font-semibold tabular-nums">{formatRupiah(data.average)}/hari</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Hari terboros</p>
            <p className="font-semibold">{data.peak ? `${formatWeekdayShort(data.peak.date)} (${formatCompact(data.peak.expense)})` : '–'}</p>
          </div>
        </div>
      </section>

      <Card
        title="Pengeluaran harian"
        aside={
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input type="checkbox" checked={showIncome} onChange={(e) => setShowIncome(e.target.checked)} className="size-4 accent-primary" />
            Pemasukan
          </label>
        }
      >
        {showIncome && (
          <div className="mb-2">
            <Legend
              items={[
                { label: 'Pengeluaran', color: colors.expense },
                { label: 'Pemasukan', color: colors.income },
              ]}
            />
          </div>
        )}
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart
              data={data.days}
              margin={{ top: 16, right: 4, bottom: 0, left: 0 }}
              barGap={2}
              onClick={(state: { activeIndex?: number | string | null; activeTooltipIndex?: number | string | null }) => {
                const index = Number(state?.activeIndex ?? state?.activeTooltipIndex)
                if (Number.isFinite(index)) setSelected(index === selected ? null : index)
              }}
            >
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 12 }} />
              <YAxis width={40} tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={formatCompact} />
              <Tooltip
                cursor={{ fill: colors.grid, opacity: 0.5 }}
                content={
                  <ChartTooltip
                    title={(_, d) => formatDayLong(String(d?.date))}
                    rows={(d) => [
                      { label: 'Pengeluaran', value: Number(d.expense), color: colors.expense },
                      ...(showIncome ? [{ label: 'Pemasukan', value: Number(d.income), color: colors.income }] : []),
                    ]}
                  />
                }
              />
              {dailyTarget !== null && (
                <ReferenceLine
                  y={dailyTarget}
                  stroke={colors.muted}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{ value: `Target ≤ ${formatCompact(dailyTarget)}`, position: 'insideTopRight', fill: colors.muted, fontSize: 11 }}
                />
              )}
              <Bar dataKey="expense" name="Pengeluaran" fill={colors.expense} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reducedMotion()} />
              {showIncome && (
                <Bar dataKey="income" name="Pemasukan" fill={colors.income} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={!reducedMotion()} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {pick ? (
          <Link to={drillDay(pick.date)} className="mt-2 flex min-h-11 items-center gap-2 rounded-2xl bg-surface-muted px-3 text-sm">
            <span className="flex-1">
              <b>{formatDayLong(pick.date)}</b> · {formatRupiah(pick.expense)}
            </span>
            <span className="font-semibold text-primary">Lihat transaksi</span>
            <ChevronRight className="size-4 text-primary" aria-hidden="true" />
          </Link>
        ) : (
          <p className="mt-2 text-center text-xs text-text-muted">Ketuk batang untuk melihat transaksinya</p>
        )}
      </Card>

      <CategoryBreakdown rows={data.categories} categories={categories} period={period} walletId={walletId} caption={`${periodLength(period)} hari`} />
    </div>
  )
}
