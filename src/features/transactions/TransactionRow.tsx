import { ArrowLeftRight, Repeat, SlidersHorizontal, Undo2 } from 'lucide-react'
import { IconBadge } from '../../components/IconBadge'
import type { Category, Transaction, Wallet } from '../../db/types'
import { addDays, formatDayShort, todayKey } from '../../lib/dates'
import { signedAmount, transactionTitle } from './transactionDisplay'

type Props = {
  tx: Transaction
  categories: Map<string, Category>
  wallets: Map<string, Wallet>
  onOpen: (id: string) => void
  /** Lists that aren't grouped by day (Beranda) say which day each row belongs to. */
  showDate?: boolean
}

const TILE = 'grid size-11 shrink-0 place-items-center rounded-[10px] border border-border bg-surface-muted'

/** One ledger line: tile, title over "category · wallet · time", amount right-aligned. */
export function TransactionRow({ tx, categories, wallets, onOpen, showDate = false }: Props) {
  const category = tx.categoryId ? categories.get(tx.categoryId) : undefined
  const wallet = wallets.get(tx.walletId)
  const amount = signedAmount(tx)
  const walletText =
    tx.type === 'transfer' ? `${wallet?.name ?? '?'} → ${wallets.get(tx.toWalletId ?? '')?.name ?? '?'}` : (wallet?.name ?? '')
  const today = todayKey()
  const when = !showDate || tx.date === today ? tx.time : tx.date === addDays(today, -1) ? 'Kemarin' : formatDayShort(tx.date)
  // Time first: when the line is too long, the category is what gets cut off.
  const subtitle = [when, walletText, tx.note && category ? category.name : null].filter(Boolean).join(' · ')

  return (
    <li>
      <button
        type="button"
        // Admin-fee rows open their transfer (FR-1.5).
        onClick={() => onOpen(tx.linkedId ?? tx.id)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted"
      >
        {tx.type === 'transfer' ? (
          <span className={TILE} aria-hidden="true">
            <ArrowLeftRight className="size-5" strokeWidth={1.75} />
          </span>
        ) : tx.type === 'adjustment' ? (
          <span className={`${TILE} text-text-muted`} aria-hidden="true">
            <SlidersHorizontal className="size-5" strokeWidth={1.75} />
          </span>
        ) : (
          <IconBadge icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#78716c'} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{transactionTitle(tx, categories)}</span>
            {tx.recurringId && <Repeat className="size-3.5 shrink-0 text-text-muted" aria-label="Transaksi rutin" />}
            {tx.type === 'refund' && <Undo2 className="size-3.5 shrink-0 text-income" aria-label="Refund" />}
          </span>
          <span className="block truncate text-[13px] text-text-muted">{subtitle}</span>
        </span>
        <span className={`shrink-0 text-[15px] font-semibold ${amount.className}`}>{amount.text}</span>
      </button>
    </li>
  )
}
