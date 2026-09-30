import { Check } from 'lucide-react'
import { createElement, useState, type ReactNode } from 'react'
import { PICKER_COLORS } from '../lib/palette'
import { formatNumber, parseAmountInput } from '../lib/money'
import { ICONS } from './icons'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass = 'mt-1 min-h-12 w-full rounded-2xl bg-surface-muted px-4 outline-none focus-visible:ring-2 focus-visible:ring-primary'

/** Rupiah input that shows grouping while typing ("25.000"); negative allowed when `signed`. */
export function AmountInput({ value, onChange, signed = false, id }: { value: number; onChange: (n: number) => void; signed?: boolean; id?: string }) {
  const [negative, setNegative] = useState(value < 0)
  return (
    <div className="mt-1 flex gap-2">
      {signed && (
        <button
          type="button"
          onClick={() => {
            setNegative(!negative)
            onChange(-value)
          }}
          aria-label={negative ? 'Jadikan positif' : 'Jadikan negatif'}
          className="min-h-12 w-12 rounded-2xl bg-surface-muted text-lg font-bold"
        >
          {negative ? '−' : '+'}
        </button>
      )}
      <div className="flex min-h-12 flex-1 items-center rounded-2xl bg-surface-muted px-4 focus-within:ring-2 focus-within:ring-primary">
        <span className="mr-2 text-text-muted">Rp</span>
        <input
          id={id}
          inputMode="numeric"
          value={value ? formatNumber(Math.abs(value)) : ''}
          placeholder="0"
          onChange={(e) => {
            const n = parseAmountInput(e.target.value)
            onChange(negative ? -n : n)
          }}
          className="min-w-0 flex-1 bg-transparent py-3 text-lg font-semibold tabular-nums outline-none"
        />
      </div>
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Warna" className="mt-2 grid grid-cols-7 gap-2">
      {PICKER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className="grid aspect-square place-items-center rounded-full"
          style={{ background: color }}
        >
          {value === color && <Check className="size-5 text-white" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Ikon" className="mt-2 grid grid-cols-7 gap-2">
      {Object.entries(ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          onClick={() => onChange(name)}
          className={`grid aspect-square place-items-center rounded-2xl ${value === name ? 'ring-2 ring-primary' : 'bg-surface-muted'}`}
          style={value === name ? { background: color, color: '#fff' } : undefined}
        >
          {createElement(Icon, { className: 'size-5', 'aria-hidden': true })}
        </button>
      ))}
    </div>
  )
}

/** A destructive button that asks "yakin?" inline on the first tap — no modal needed. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className }: { label: ReactNode; confirmLabel: string; onConfirm: () => void; className: string }) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={className}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
