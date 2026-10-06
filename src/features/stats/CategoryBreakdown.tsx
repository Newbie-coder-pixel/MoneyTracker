import { useNavigate } from 'react-router'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { IconBadge } from '../../components/IconBadge'
import type { Budget, Category } from '../../db/types'
import { budgetLevel, budgetPercent } from '../../lib/budget'
import { formatCompact, formatRupiah } from '../../lib/money'
import type { Period } from '../../lib/period'
import { foldCategories, OTHER_SLICE } from '../../lib/stats'
import { Card, ChartTooltip } from './chartParts'
import { reducedMotion } from './motion'
import { useChartColors } from './useChartColors'

const OTHER_COLOR = '#78716c'
const LEVEL_BAR = { safe: 'bg-accent', warning: 'bg-warning', over: 'bg-expense' }
const LEVEL_TEXT = { safe: 'aman', warning: 'hampir habis', over: 'terlampaui' }

type Props = {
  rows: { categoryId: string; amount: number }[]
  categories: Map<string, Category>
  period: Period
  walletId?: string
  /** Monthly view shows each category's budget progress (FR-5.2). */
  budgets?: Budget[]
  caption: string
}

/** Donut of expense per category plus the ranked list; tapping drills into Riwayat (FR-5.5). */
export function CategoryBreakdown({ rows, categories, period, walletId, budgets, caption }: Props) {
  const colors = useChartColors()
  const navigate = useNavigate()
  const total = rows.reduce((s, r) => s + r.amount, 0)
  // Top 5 slices; the tail folds into one gray "Lainnya" slice. The list below stays complete.
  const slices = foldCategories(rows, 5).map((r) => {
    const c = categories.get(r.categoryId)
    return {
      ...r,
      name: r.categoryId === OTHER_SLICE ? 'Kategori lain' : (c?.name ?? 'Kategori'),
      color: r.categoryId === OTHER_SLICE ? OTHER_COLOR : (c?.color ?? OTHER_COLOR),
    }
  })

  const drill = (categoryId: string) => {
    const params = new URLSearchParams({ from: period.start, to: period.end })
    if (categoryId !== OTHER_SLICE) params.set('cat', categoryId)
    params.set('type', 'expense')
    if (walletId) params.set('wallet', walletId)
    navigate(`/riwayat?${params}`)
  }

  if (!rows.length) {
    return (
      <Card title="Pengeluaran per kategori">
        <p className="py-8 text-center text-sm text-text-muted">Belum ada pengeluaran di periode ini.</p>
      </Card>
    )
  }

  return (
    <Card title="Pengeluaran per kategori" aside={<span className="text-xs text-text-muted">{rows.length} kategori</span>}>
      <div className="relative mx-auto h-56 max-w-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              stroke={colors.surface}
              strokeWidth={2}
              isAnimationActive={!reducedMotion()}
              onClick={(_, index) => drill(slices[index].categoryId)}
              className="cursor-pointer"
            >
              {slices.map((s) => (
                <Cell key={s.categoryId} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  title={(_, d) => String(d?.name ?? '')}
                  rows={(d) => [{ label: `${Math.round((Number(d.amount) / total) * 100)}%`, value: Number(d.amount), color: String(d.color) }]}
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-text-muted">Total</p>
            <p className="text-xl font-bold tracking-tight">Rp {formatCompact(total)}</p>
            <p className="text-xs text-text-muted">{caption}</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-border border-t border-border">
        {rows.map((row) => {
          const c = categories.get(row.categoryId)
          const budget = budgets?.find((b) => b.categoryId === row.categoryId)
          const pct = Math.round((row.amount / total) * 100)
          return (
            <li key={row.categoryId}>
              <button type="button" onClick={() => drill(row.categoryId)} className="w-full py-3 text-left active:bg-surface-muted">
                <span className="flex items-center gap-3">
                  <IconBadge icon={c?.icon ?? 'ellipsis'} color={c?.color ?? OTHER_COLOR} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{c?.name ?? 'Kategori'}</span>
                    <span className="block text-xs text-text-muted">
                      {budget
                        ? `${formatRupiah(row.amount)} dari ${formatRupiah(budget.amount)} · ${LEVEL_TEXT[budgetLevel(row.amount, budget.amount)]}`
                        : `${pct}% dari total`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-semibold">{budget ? `${budgetPercent(row.amount, budget.amount)}%` : formatRupiah(row.amount)}</span>
                  </span>
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  {budget ? (
                    <span
                      className={`block h-full rounded-full ${LEVEL_BAR[budgetLevel(row.amount, budget.amount)]}`}
                      style={{ width: `${Math.min(100, budgetPercent(row.amount, budget.amount))}%` }}
                    />
                  ) : (
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: c?.color ?? OTHER_COLOR }} />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
