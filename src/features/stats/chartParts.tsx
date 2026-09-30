import type { ReactNode } from 'react'
import { formatRupiah } from '../../lib/money'

type TooltipRow = { label: string; value: number; color: string; dashed?: boolean }

type TooltipProps = {
  active?: boolean
  label?: string | number
  payload?: { dataKey?: string | number; value?: number | null; payload?: Record<string, unknown> }[]
  /** Title for the hovered x value. */
  title: (label: string | number, datum: Record<string, unknown> | undefined) => string
  rows: (datum: Record<string, unknown>) => TooltipRow[]
}

/** Shared Recharts tooltip: text stays in text tokens, a swatch carries identity. */
export function ChartTooltip({ active, label, payload, title, rows }: TooltipProps) {
  const datum = payload?.[0]?.payload
  if (!active || !datum || label === undefined) return null
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-text">{title(label, datum)}</p>
      {rows(datum).map((row) => (
        <p key={row.label} className="flex items-center gap-2 text-text-muted">
          <Swatch color={row.color} dashed={row.dashed} />
          <span className="flex-1">{row.label}</span>
          <span className="font-semibold text-text tabular-nums">{formatRupiah(row.value)}</span>
        </p>
      ))}
    </div>
  )
}

export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: color }} aria-hidden="true" />
  ) : (
    <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <Swatch color={item.color} dashed={item.dashed} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function Card({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** "12% lebih hemat" / "8% lebih boros" / "Baru" (PRD §6.2). */
export function ChangeBadge({ change, suffix }: { change: number | null; suffix: string }) {
  if (change === null) return <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold">Baru</span>
  const saving = change <= 0
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${saving ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'}`}>
      {saving ? '↓' : '↑'} {Math.abs(Math.round(change))}% {saving ? 'lebih hemat' : 'lebih boros'} {suffix}
    </span>
  )
}
