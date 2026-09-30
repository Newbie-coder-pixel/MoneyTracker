import { Sheet } from '../../components/Sheet'
import { ADD_KINDS, type AddKind } from './addSheetParam'

const LABELS: Record<AddKind, { tab: string; subtitle: string }> = {
  expense: { tab: 'Pengeluaran', subtitle: 'Catat pengeluaran harianmu' },
  income: { tab: 'Pemasukan', subtitle: 'Catat uang yang masuk' },
  transfer: { tab: 'Transfer', subtitle: 'Pindahkan saldo antar dompet' },
}

type Props = {
  kind: AddKind | null
  onKindChange: (kind: AddKind) => void
  onClose: () => void
}

export function AddTransactionSheet({ kind, onKindChange, onClose }: Props) {
  const active = kind ?? 'expense'

  return (
    <Sheet open={kind !== null} onClose={onClose} title="Tambah Transaksi" subtitle={LABELS[active].subtitle}>
      <div role="group" aria-label="Jenis transaksi" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
        {ADD_KINDS.map((k) => {
          const selected = k === active
          const selectedColor = k === 'expense' ? 'bg-expense text-on-expense' : 'bg-primary text-on-primary'
          return (
            <button
              key={k}
              type="button"
              aria-pressed={selected}
              onClick={() => onKindChange(k)}
              className={`min-h-11 rounded-xl text-sm font-semibold ${selected ? selectedColor : 'text-text-muted'}`}
            >
              {LABELS[k].tab}
            </button>
          )
        })}
      </div>

      {/* Stage 3 (FR-1.1–FR-1.8) replaces this with the amount keypad, category grid and wallet picker. */}
      <p className="py-16 text-center text-sm text-text-muted">Form transaksi dibangun di tahap 3.</p>
    </Sheet>
  )
}
