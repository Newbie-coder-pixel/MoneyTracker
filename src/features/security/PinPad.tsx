import { Delete } from 'lucide-react'
import { PIN_MAX } from '../../lib/pin'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const

/** Dots + number pad. Calls onSubmit when "OK" is pressed or PIN_MAX digits are entered. */
export function PinPad({
  value,
  onChange,
  onSubmit,
  minLength,
  error,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (v: string) => void
  minLength: number
  error?: string | null
}) {
  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'back') return onChange(value.slice(0, -1))
    if (!key || value.length >= PIN_MAX) return
    const next = value + key
    onChange(next)
    if (next.length === PIN_MAX) onSubmit(next)
  }

  return (
    <div className="mx-auto w-full max-w-xs space-y-6">
      <div className="flex justify-center gap-3">
        <span className="sr-only" aria-live="polite">
          {value.length} digit dimasukkan
        </span>
        {Array.from({ length: PIN_MAX }, (_, i) => (
          <span key={i} aria-hidden="true" className={`size-3 rounded-full border ${i < value.length ? 'border-primary bg-primary' : 'border-text-muted/50'}`} />
        ))}
      </div>
      <p role="alert" className="min-h-5 text-center text-sm text-expense">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === '' ? (
            <button
              key={i}
              type="button"
              disabled={value.length < minLength}
              onClick={() => onSubmit(value)}
              className="h-14 rounded-xl bg-primary text-base font-semibold text-on-primary disabled:opacity-30"
            >
              OK
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              aria-label={key === 'back' ? 'Hapus' : key}
              className="grid h-14 place-items-center rounded-xl border border-border bg-surface text-xl font-semibold active:bg-surface-muted"
            >
              {key === 'back' ? <Delete className="size-6" aria-hidden="true" /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
