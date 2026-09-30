import { ArrowLeftRight, Repeat, SlidersHorizontal, Undo2 } from 'lucide-react'
import { IconBadge } from '../../components/IconBadge'
import type { Category, Transaction, Wallet } from '../../db/types'
import { signedAmount, transactionTitle } from './transactionDisplay'

type Props = {
  tx: Transaction
  categories: Map<string, Category>
  wallets: Map<string, Wallet>
  onOpen: (id: string) => void
  /** Show the time (history) or not (compact lists). */
  showTime?: boolean
}

export function TransactionRow({ tx, categories, wallets, onOpen, showTime = true }: Props) {
  const category = tx.categoryId ? categories.get(tx.categoryId) : undefined
  const wallet = wallets.get(tx.walletId)
  const amount = signedAmount(tx)
  const walletText =
    tx.type === 'transfer' ? `${wallet?.name ?? '?'} → ${wallets.get(tx.toWalletId ?? '')?.name ?? '?'}` : (wallet?.name ?? '')
  const subtitle = [tx.note && category ? category.name : null, walletText].filter(Boolean).join(' • ')

  return (
    <li>
      <button
        type="button"
        // Admin-fee rows open their transfer (FR-1.5).
        onClick={() => onOpen(tx.linkedId ?? tx.id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted"
      >
        {tx.type === 'transfer' ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
            <ArrowLeftRight className="size-5" />
          </span>
        ) : tx.type === 'adjustment' ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-text-muted" aria-hidden="true">
            <SlidersHorizontal className="size-5" />
          </span>
        ) : (
          <IconBadge icon={category?.icon ?? 'ellipsis'} color={category?.color ?? '#78716c'} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{transactionTitle(tx, categories)}</span>
            {tx.recurringId && <Repeat className="size-3.5 shrink-0 text-primary" aria-label="Transaksi rutin" />}
            {tx.type === 'refund' && <Undo2 className="size-3.5 shrink-0 text-income" aria-label="Refund" />}
          </span>
          <span className="block truncate text-sm text-text-muted">{subtitle}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block font-semibold tabular-nums ${amount.className}`}>{amount.text}</span>
          {showTime && <span className="block text-xs text-text-muted">{tx.time}</span>}
        </span>
      </button>
    </li>
  )
}
