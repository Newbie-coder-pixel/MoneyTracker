import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Budget, Category, Transaction } from '../../db/types'
import { TOTAL_BUDGET_ID } from '../../db/types'
import { eachDay, formatDayLong, formatMonthShort, todayKey } from '../../lib/dates'
import { formatCompact, formatRupiah, formatSignedRupiah } from '../../lib/money'
import { monthPeriodByKey, monthPeriodName, percentChange, shiftMonthKey, type Period } from '../../lib/period'
import { cumulative, dailyFlows, elapsedDays, expenseByCategory, flowTotals } from '../../lib/stats'
import { CategoryBreakdown } from './CategoryBreakdown'
import { Card, ChangeBadge, ChartTooltip, Legend } from './chartParts'
import { reducedMotion } from './motion'
import { useChartColors } from './useChartColors'

type Props = {
  period: Period
  startDay: number
  txs: Transaction[]
  budgets: Budget[]
  categories: Map<string, Category>
  walletId?: string
}

export function MonthlyView({ period, startDay, txs, budgets, categories, walletId }: Props) {
  const colors = useChartColors()

  const data = useMemo(() => {
    const filter = { walletId }
    const today = todayKey()
    const previous = monthPeriodByKey(shiftMonthKey(period.key, -1), startDay)
    const totals = flowTotals(txs, period, filter)
    const prevTotals = flowTotals(txs, previous, filter)

    // Cumulative spend by day-of-period, with last month aligned by index (FR-5.2).
    const thisDays = eachDay(period.start, period.end)
    const thisCum = cumulative(dailyFlows(txs, thisDays, filter).map((d) => d.expense))
    const prevCum = cumulative(dailyFlows(txs, eachDay(previous.start, previous.end), filter).map((d) => d.expense))
    const line = thisDays.map((date, i) => ({
      day: i + 1,
      date,
      current: date <= today ? thisCum[i] : null,
      previous: prevCum[i] ?? null,
    }))

    const periodBudgets = budgets.filter((b) => b.period === period.key)
    const totalBudget =
      periodBudgets.find((b) => b.categoryId === TOTAL_BUDGET_ID)?.amount ??
      (periodBudgets.length ? periodBudgets.reduce((s, b) => s + b.amount, 0) : null)

    const trend = Array.from({ length: 6 }, (_, i) => {
      const p = monthPeriodByKey(shiftMonthKey(period.key, i - 5), startDay)
      const t = flowTotals(txs, p, filter)
      return { key: p.key, label: formatMonthShort(`${p.key}-01`), income: t.income, expense: t.expense, net: t.income - t.expense }
    })

    const elapsed = elapsedDays(period, today)
    return {
      totals,
      net: totals.income - totals.expense,
      average: elapsed ? Math.round(totals.expense / elapsed) : 0,
      change: percentChange(totals.expense, prevTotals.expense),
      line,
      previousName: monthPeriodName(previous),
      totalBudget,
      periodBudgets,
      trend,
      categories: expenseByCategory(txs, period, filter),
    }
  }, [txs, budgets, period, startDay, walletId])

  const name = monthPeriodName(period)

  return (
    <div className="space-y-4">
      <section className="card grid grid-cols-2 overflow-hidden [&>div:nth-child(-n+2)]:border-b [&>div:nth-child(odd)]:border-r">
        <Stat label="Pemasukan" value={`+${formatRupiah(data.totals.income)}`} className="text-income" />
        <Stat label="Pengeluaran" value={`-${formatRupiah(data.totals.expense)}`} className="text-expense" />
        <Stat label="Selisih" value={formatSignedRupiah(data.net)} className={data.net >= 0 ? 'text-income' : 'text-expense'} />
        <Stat label="Rata-rata harian" value={formatRupiah(data.average)} />
        <div className="col-span-2 flex justify-center border-t border-border py-3">
          <ChangeBadge change={data.change} suffix="dari bulan lalu" />
        </div>
      </section>

      <Card title="Akumulasi pengeluaran">
        <div className="mb-2">
          <Legend
            items={[
              { label: name, color: colors.expense },
              { label: data.previousName, color: colors.muted },
              ...(data.totalBudget !== null ? [{ label: `Budget ${formatCompact(data.totalBudget)}`, color: colors.muted, dashed: true }] : []),
            ]}
          />
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={data.line} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                ticks={[1, 8, 15, 22, data.line.length]}
                tick={{ fill: colors.muted, fontSize: 11 }}
                tickFormatter={(d: number) => `Tgl ${Number(data.line[d - 1]?.date.slice(8))}`}
              />
              <YAxis width={40} tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={formatCompact} />
              <Tooltip
                cursor={{ stroke: colors.muted, strokeWidth: 1 }}
                content={
                  <ChartTooltip
                    title={(_, d) => formatDayLong(String(d?.date))}
                    rows={(d) => [
                      ...(d.current !== null ? [{ label: name, value: Number(d.current), color: colors.expense }] : []),
                      ...(d.previous !== null ? [{ label: data.previousName, value: Number(d.previous), color: colors.muted }] : []),
                    ]}
                  />
                }
              />
              {data.totalBudget !== null && <ReferenceLine y={data.totalBudget} stroke={colors.muted} strokeDasharray="4 4" ifOverflow="extendDomain" />}
              <Line type="monotone" dataKey="previous" stroke={colors.muted} strokeWidth={2} strokeOpacity={0.6} dot={false} isAnimationActive={!reducedMotion()} />
              <Line type="monotone" dataKey="current" stroke={colors.expense} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: colors.surface, strokeWidth: 2 }} connectNulls={false} isAnimationActive={!reducedMotion()} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <CategoryBreakdown
        rows={data.categories}
        categories={categories}
        period={period}
        walletId={walletId}
        budgets={data.periodBudgets}
        caption={name.split(' ')[0]}
      />

      <Card title="Tren 6 bulan">
        <div className="mb-2">
          <Legend
            items={[
              { label: 'Pemasukan', color: colors.income },
              { label: 'Pengeluaran', color: colors.expense },
            ]}
          />
        </div>
        <div className="h-52">
          <ResponsiveContainer>
            <BarChart data={data.trend} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 12 }} />
              <YAxis width={40} tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={formatCompact} />
              <Tooltip
                cursor={{ fill: colors.grid, opacity: 0.5 }}
                content={
                  <ChartTooltip
                    title={(_, d) => monthPeriodName(monthPeriodByKey(String(d?.key), startDay))}
                    rows={(d) => [
                      { label: 'Pemasukan', value: Number(d.income), color: colors.income },
                      { label: 'Pengeluaran', value: Number(d.expense), color: colors.expense },
                    ]}
                  />
                }
              />
              <Bar dataKey="income" fill={colors.income} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={!reducedMotion()} />
              <Bar dataKey="expense" fill={colors.expense} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={!reducedMotion()} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Net per month as a table: the chart's text view and the "selisih" the PRD asks for. */}
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">Pemasukan, pengeluaran dan selisih 6 bulan terakhir</caption>
          <thead className="label-caps">
            <tr>
              <th className="py-1 text-left font-semibold">Bulan</th>
              <th className="py-1 text-right font-semibold">Masuk</th>
              <th className="py-1 text-right font-semibold">Keluar</th>
              <th className="py-1 text-right font-semibold">Selisih</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.trend.map((m) => (
              <tr key={m.key} className="border-t border-border">
                <td className="py-1.5">{m.label}</td>
                <td className="py-1.5 text-right">{formatCompact(m.income)}</td>
                <td className="py-1.5 text-right">{formatCompact(m.expense)}</td>
                <td className={`py-1.5 text-right font-semibold ${m.net >= 0 ? 'text-income' : 'text-expense'}`}>
                  {m.net > 0 ? '+' : ''}
                  {formatCompact(m.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="border-border px-4 py-3">
      <p className="label-caps">{label}</p>
      <p className={`mt-0.5 truncate text-[15px] font-semibold ${className}`}>{value}</p>
    </div>
  )
}
