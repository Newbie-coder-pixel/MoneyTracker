import { Delete } from 'lucide-react'
import { applyKeypad, type KeypadKey } from '../lib/money'

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back']

/** Big on-screen number pad (FR-1.3). */
export function AmountKeypad({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(applyKeypad(value, key))}
          aria-label={key === 'back' ? 'Hapus angka' : key}
          className={`grid h-12 place-items-center rounded-xl border border-border bg-surface font-semibold active:bg-border ${key === '000' ? 'text-base' : 'text-xl'}`}
        >
          {key === 'back' ? <Delete className="size-6" strokeWidth={1.75} aria-hidden="true" /> : key}
        </button>
      ))}
    </div>
  )
}
