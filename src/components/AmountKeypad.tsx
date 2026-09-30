import { Delete } from 'lucide-react'
import { applyKeypad, type KeypadKey } from '../lib/money'

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back']

/** Big on-screen number pad (FR-1.3). */
export function AmountKeypad({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-3xl bg-surface-muted p-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(applyKeypad(value, key))}
          aria-label={key === 'back' ? 'Hapus angka' : key}
          className="grid h-12 place-items-center rounded-2xl bg-surface text-xl font-semibold active:bg-primary-soft"
        >
          {key === 'back' ? <Delete className="size-6 text-expense" aria-hidden="true" /> : key}
        </button>
      ))}
    </div>
  )
}
