import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Repeat, Trash2 } from 'lucide-react'
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
  safe: { bar: 'bg-accent', badge: 'bg-income-soft text-income', label: 'Aman' },
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
      <AppHeader title="Budget" eyebrow="Anggaran bulanan" back />
      <main className="space-y-4 p-4">
        <div className="card flex items-center gap-1 p-1">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Bulan sebelumnya" className="grid size-11 place-items-center rounded-lg active:bg-surface-muted">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <p className="flex flex-1 items-center justify-center gap-2 text-center text-sm font-semibold" aria-live="polite">
            <CalendarDays className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            {monthPeriodLabel(period)}
          </p>
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Bulan berikutnya" className="grid size-11 place-items-center rounded-lg active:bg-surface-muted">
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="label-caps">{total ? 'Sisa total anggaran' : 'Sisa budget kategori'}</p>
            {summary && <LevelBadge spent={summary.spent} amount={summary.amount} />}
          </div>
          {summary ? (
            <>
              <p className={`mt-2 text-[2rem] leading-10 font-bold tracking-tight ${summary.spent > summary.amount ? 'text-expense' : ''}`}>
                {formatRupiah(Math.abs(summary.amount - summary.spent))}{' '}
                <span className="text-sm font-normal tracking-normal text-text-muted">{summary.spent > summary.amount ? 'terlampaui' : 'tersisa'}</span>
              </p>
              <p className="mt-1 flex justify-between gap-2 text-[13px] text-text-muted">
                <span>
                  <b className="font-semibold text-text">{formatRupiah(summary.spent)}</b> terpakai
                </span>
                <span>
                  dari <b className="font-semibold text-text">{formatRupiah(summary.amount)}</b>
                </span>
              </p>
              <ProgressBar spent={summary.spent} amount={summary.amount} />
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-[13px] text-text-muted">
                <span>
                  Sisa per hari <b className="font-semibold text-text">{formatRupiah(perDayAllowance(summary.amount, summary.spent, daysLeft))}</b>
                </span>
                <span>{daysLeft > 0 ? `${daysLeft} hari lagi` : 'Periode selesai'}</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-lg font-semibold">Belum ada budget</p>
          )}
          <button
            type="button"
            onClick={() => setEditing({ categoryId: TOTAL_BUDGET_ID, budget: total?.budget })}
            className="mt-4 min-h-11 w-full rounded-full border border-border text-[13px] font-semibold active:bg-surface-muted"
          >
            {total ? 'Ubah total anggaran' : 'Atur total anggaran (opsional)'}
          </button>
        </section>

        {rows && rows.length > 0 && (
          <label className="card flex min-h-16 items-center gap-3 px-4 py-2">
            <Repeat className="size-5 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Ulangi otomatis tiap bulan</span>
              <span className="block text-xs text-text-muted">Budget ini disalin ke periode berikutnya.</span>
            </span>
            <input type="checkbox" checked={autoRepeat} onChange={(e) => void setAutoRepeat(period.key, e.target.checked)} className="size-5 accent-primary" />
          </label>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setEditing({})} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-on-primary">
            <Plus className="size-4" aria-hidden="true" /> Budget kategori
          </button>
          <button type="button" onClick={() => void copyPrevious()} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-semibold">
            <Copy className="size-4" aria-hidden="true" /> Salin bulan lalu
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
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-[13px] ${filter === f ? 'border-primary bg-primary font-semibold text-on-primary' : 'border-border bg-surface font-medium text-text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="card divide-y divide-border overflow-hidden">
              {visible.map(({ budget, spent }) => {
                const c = categoryMap.get(budget.categoryId)
                const left = budget.amount - spent
                return (
                  <li key={budget.id}>
                    <button type="button" onClick={() => setEditing({ categoryId: budget.categoryId, budget })} className={`w-full p-4 text-left active:bg-surface-muted ${left < 0 ? 'bg-expense-soft/40' : ''}`}>
                      <span className="flex items-center gap-3">
                        <IconBadge icon={c?.icon ?? 'ellipsis'} color={c?.color ?? '#78716c'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{c?.name ?? 'Kategori'}</span>
                          <span className="block text-xs text-text-muted tabular-nums">
                            {formatRupiah(spent)} / {formatRupiah(budget.amount)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <LevelBadge spent={spent} amount={budget.amount} />
                          <span className={`mt-1 block text-[13px] font-semibold ${left < 0 ? 'text-expense' : 'text-text-muted'}`}>
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
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${level.badge}`}>{budgetPercent(spent, amount)}% · {level.label}</span>
}

function ProgressBar({ spent, amount }: { spent: number; amount: number }) {
  const pct = budgetPercent(spent, amount)
  return (
    <span
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-muted"
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
        className="min-h-13 w-full rounded-full bg-primary text-base font-semibold text-on-primary disabled:opacity-50"
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
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-expense/30 font-semibold text-expense"
        >
          <Trash2 className="size-5" aria-hidden="true" /> Hapus budget
        </button>
      )}
    </div>
  )
}
