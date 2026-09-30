import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Lightbulb, Plus, Repeat, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppHeader } from '../../components/AppHeader'
import { IconBadge } from '../../components/IconBadge'
import { AmountInput, Field, inputClass } from '../../components/Pickers'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/toast'
import { budgetsWithSpend, copyPreviousBudgets, ensureBudgetsForPeriod, removeBudget, setAutoRepeat, setBudget } from '../../db/budgets'
import { useCategories } from '../../db/hooks'
import { useSettings } from '../../db/settings'
import { TOTAL_BUDGET_ID, type Budget, type Category } from '../../db/types'
import { budgetLevel, budgetPercent, perDayAllowance, type BudgetLevel } from '../../lib/budget'
import { todayKey } from '../../lib/dates'
import { formatRupiah } from '../../lib/money'
import { daysRemaining, monthPeriodByKey, monthPeriodLabel, monthPeriodOf, shiftMonthKey, type Period } from '../../lib/period'
import { announceBudgetAlerts } from './announce'

const LEVEL = {
  safe: { bar: 'bg-primary', badge: 'bg-income-soft text-income', label: 'Aman' },
  warning: { bar: 'bg-warning', badge: 'bg-warning-soft text-warning', label: 'Hampir habis' },
  over: { bar: 'bg-expense', badge: 'bg-expense-soft text-expense', label: 'Terlampaui' },
} satisfies Record<BudgetLevel, unknown>

type Filter = 'all' | 'warning' | 'over'

export function BudgetPage() {
  const settings = useSettings()
  const [offset, setOffset] = useState(0)
  if (!settings) return <AppHeader title="Budget" back />
  const current = monthPeriodOf(todayKey(), settings.monthStartDay)
  const period = monthPeriodByKey(shiftMonthKey(current.key, offset), settings.monthStartDay)
  return <BudgetView period={period} currentKey={current.key} offset={offset} setOffset={setOffset} />
}

function BudgetView({ period, currentKey, offset, setOffset }: { period: Period; currentKey: string; offset: number; setOffset: (n: number) => void }) {
  const categories = useCategories()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ categoryId?: string; budget?: Budget } | null>(null)

  // Carry repeating budgets into this period first (a write, so not inside the live query).
  useEffect(() => {
    void ensureBudgetsForPeriod(period.key, currentKey)
  }, [period.key, currentKey])
  const rows = useLiveQuery(() => budgetsWithSpend(period), [period.key, period.start])

  const today = todayKey()
  const daysLeft = daysRemaining(period, today)
  const total = rows?.find((r) => r.budget.categoryId === TOTAL_BUDGET_ID)
  const categoryRows = (rows ?? []).filter((r) => r.budget.categoryId !== TOTAL_BUDGET_ID)
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]))
  const summary = total
    ? { amount: total.budget.amount, spent: total.spent }
    : categoryRows.length
      ? { amount: categoryRows.reduce((s, r) => s + r.budget.amount, 0), spent: categoryRows.reduce((s, r) => s + r.spent, 0) }
      : null
  const autoRepeat = rows?.[0]?.budget.autoRepeat ?? true
  const counts = {
    warning: categoryRows.filter((r) => budgetLevel(r.spent, r.budget.amount) === 'warning').length,
    over: categoryRows.filter((r) => budgetLevel(r.spent, r.budget.amount) === 'over').length,
  }
  const visible = categoryRows
    .filter((r) => filter === 'all' || budgetLevel(r.spent, r.budget.amount) === filter)
    .sort((a, b) => b.spent / b.budget.amount - a.spent / a.budget.amount)

  const copyPrevious = async () => {
    const n = await copyPreviousBudgets(period, shiftMonthKey(period.key, -1))
    showToast(n ? `${n} budget disalin dari bulan lalu` : 'Bulan lalu belum ada budget')
  }

  return (
    <>
      <AppHeader title="Budget" back />
      <main className="space-y-4 p-4">
        <div className="flex items-center gap-1 rounded-2xl bg-surface p-1">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Bulan sebelumnya" className="grid size-11 place-items-center rounded-xl">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <p className="flex flex-1 items-center justify-center gap-2 text-center text-sm font-semibold" aria-live="polite">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {monthPeriodLabel(period)}
          </p>
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Bulan berikutnya" className="grid size-11 place-items-center rounded-xl">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <section className="rounded-3xl bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-text-muted">{total ? 'Total anggaran bulanan' : 'Jumlah semua budget kategori'}</p>
              {summary ? (
                <>
                  <p className="text-3xl font-bold tabular-nums">{formatRupiah(summary.spent)}</p>
                  <p className="text-sm text-text-muted">terpakai dari {formatRupiah(summary.amount)}</p>
                </>
              ) : (
                <p className="mt-1 text-lg font-semibold">Belum ada budget</p>
              )}
            </div>
            {summary && <LevelBadge spent={summary.spent} amount={summary.amount} />}
          </div>
          {summary && (
            <>
              <ProgressBar spent={summary.spent} amount={summary.amount} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1">
                  <Lightbulb className="size-4" aria-hidden="true" /> Sisa per hari <b>{formatRupiah(perDayAllowance(summary.amount, summary.spent, daysLeft))}</b>
                </span>
                <span className="text-text-muted">{daysLeft > 0 ? `Sisa ${daysLeft} hari` : 'Periode selesai'}</span>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setEditing({ categoryId: TOTAL_BUDGET_ID, budget: total?.budget })}
            className="mt-3 min-h-11 w-full rounded-2xl bg-surface-muted text-sm font-semibold"
          >
            {total ? 'Ubah total anggaran' : 'Atur total anggaran (opsional)'}
          </button>
        </section>

        {rows && rows.length > 0 && (
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4">
            <Repeat className="size-5 text-primary" aria-hidden="true" />
            <span className="flex-1">
              <span className="block font-medium">Ulangi otomatis tiap bulan</span>
              <span className="block text-xs text-text-muted">Budget ini disalin ke periode berikutnya.</span>
            </span>
            <input type="checkbox" checked={autoRepeat} onChange={(e) => void setAutoRepeat(period.key, e.target.checked)} className="size-5 accent-primary" />
          </label>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEditing({})} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-on-primary">
            <Plus className="size-5" aria-hidden="true" /> Budget kategori
          </button>
          <button type="button" onClick={() => void copyPrevious()} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface font-semibold">
            <Copy className="size-5" aria-hidden="true" /> Salin bulan lalu
          </button>
        </div>

        {categoryRows.length > 0 && (
          <section>
            <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
              {(
                [
                  ['all', `Semua (${categoryRows.length})`],
                  ['warning', `Hampir habis (${counts.warning})`],
                  ['over', `Melebihi (${counts.over})`],
                ] as const
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ${filter === f ? 'bg-primary text-on-primary' : 'bg-surface'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {visible.map(({ budget, spent }) => {
                const c = categoryMap.get(budget.categoryId)
                const left = budget.amount - spent
                return (
                  <li key={budget.id}>
                    <button type="button" onClick={() => setEditing({ categoryId: budget.categoryId, budget })} className="w-full rounded-3xl bg-surface p-4 text-left">
                      <span className="flex items-center gap-3">
                        <IconBadge icon={c?.icon ?? 'ellipsis'} color={c?.color ?? '#78716c'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{c?.name ?? 'Kategori'}</span>
                          <span className="block text-xs text-text-muted tabular-nums">
                            {formatRupiah(spent)} / {formatRupiah(budget.amount)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <LevelBadge spent={spent} amount={budget.amount} />
                          <span className={`mt-1 block text-sm font-semibold tabular-nums ${left < 0 ? 'text-expense' : ''}`}>
                            {left >= 0 ? `Sisa ${formatRupiah(left)}` : `Lewat ${formatRupiah(-left)}`}
                          </span>
                        </span>
                      </span>
                      <ProgressBar spent={spent} amount={budget.amount} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </main>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.categoryId === TOTAL_BUDGET_ID ? 'Total anggaran' : 'Budget kategori'}>
        {editing && (
          <BudgetForm
            period={period}
            categoryId={editing.categoryId}
            budget={editing.budget}
            available={(categories ?? []).filter((c) => c.kind === 'expense' && !c.archived && !categoryRows.some((r) => r.budget.categoryId === c.id))}
            categoryMap={categoryMap}
            onDone={() => setEditing(null)}
          />
        )}
      </Sheet>
    </>
  )
}

function LevelBadge({ spent, amount }: { spent: number; amount: number }) {
  const level = LEVEL[budgetLevel(spent, amount)]
  // Status always carries a text label, never colour alone.
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${level.badge}`}>{budgetPercent(spent, amount)}% · {level.label}</span>
}

function ProgressBar({ spent, amount }: { spent: number; amount: number }) {
  const pct = budgetPercent(spent, amount)
  return (
    <span
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="mt-3 block h-2.5 overflow-hidden rounded-full bg-surface-muted"
    >
      <span className={`block h-full rounded-full ${LEVEL[budgetLevel(spent, amount)].bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
  )
}

function BudgetForm({
  period,
  categoryId: initialCategory,
  budget,
  available,
  categoryMap,
  onDone,
}: {
  period: Period
  categoryId?: string
  budget?: Budget
  available: Category[]
  categoryMap: Map<string, Category>
  onDone: () => void
}) {
  const [categoryId, setCategoryId] = useState(initialCategory ?? available[0]?.id ?? '')
  const [amount, setAmount] = useState(budget?.amount ?? 0)
  const isTotal = categoryId === TOTAL_BUDGET_ID

  return (
    <div className="space-y-4">
      {budget || isTotal ? (
        !isTotal && (
          <p className="flex items-center gap-3">
            <IconBadge icon={categoryMap.get(categoryId)?.icon ?? 'ellipsis'} color={categoryMap.get(categoryId)?.color ?? '#78716c'} />
            <b>{categoryMap.get(categoryId)?.name}</b>
          </p>
        )
      ) : available.length ? (
        <Field label="Kategori">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-sm text-text-muted">Semua kategori sudah punya budget.</p>
      )}
      <Field label={`Budget ${monthPeriodLabel(period)}`}>
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <button
        type="button"
        disabled={!categoryId || amount <= 0}
        onClick={async () => {
          const alerts = await setBudget(period, categoryId, amount)
          showToast('Budget disimpan')
          announceBudgetAlerts(alerts)
          onDone()
        }}
        className="min-h-14 w-full rounded-2xl bg-primary text-lg font-semibold text-on-primary disabled:opacity-50"
      >
        Simpan
      </button>
      {budget && (
        <button
          type="button"
          onClick={async () => {
            await removeBudget(budget.id)
            showToast('Budget dihapus')
            onDone()
          }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-expense-soft font-semibold text-expense"
        >
          <Trash2 className="size-5" aria-hidden="true" /> Hapus budget
        </button>
      )}
    </div>
  )
}
