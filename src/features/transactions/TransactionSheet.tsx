import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2 } from 'lucide-react'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/toast'
import { useWallets } from '../../db/hooks'
import { db } from '../../db/schema'
import { useSettings } from '../../db/settings'
import { deleteTransaction, restoreTransactions } from '../../db/transactions'
import type { Transaction } from '../../db/types'
import { formatDayLong } from '../../lib/dates'
import { formatSignedRupiah } from '../../lib/money'
import { TransactionForm } from './TransactionForm'
import { useTransactionSheet } from './useTransactionSheet'

export function TransactionSheet() {
  const sheet = useTransactionSheet()
  const wallets = useWallets()
  const settings = useSettings()
  const edit = useLiveQuery(async () => {
    if (!sheet.editId) return null
    const tx = await db.transactions.get(sheet.editId)
    if (!tx) return { tx: undefined, fee: undefined }
    const fee = tx.type === 'transfer' ? await db.transactions.where('linkedId').equals(tx.id).first() : undefined
    return { tx, fee }
  }, [sheet.editId])

  const active = wallets?.filter((w) => !w.archived) ?? []
  const defaultWalletId =
    active.find((w) => w.id === sheet.prefillFrom)?.id ?? active.find((w) => w.id === settings?.lastWalletId)?.id ?? active[0]?.id ?? ''
  const ready = wallets && settings && (!sheet.editId || edit)

  // The form has its own header (type dropdown, back, close).
  const showsForm = !!ready && !(sheet.editId && (!edit?.tx || edit.tx.type === 'adjustment'))

  const title = sheet.editId ? 'Ubah Transaksi' : 'Tambah Transaksi'

  return (
    <Sheet open={sheet.isOpen} onClose={sheet.close} title={title} bareHeader={showsForm}>
      {/* Mounted only while open, so every opening starts with a fresh form. */}
      {sheet.isOpen && ready && (
        <>
          {sheet.editId && !edit?.tx ? (
            <p className="py-10 text-center text-sm text-text-muted">Transaksi tidak ditemukan.</p>
          ) : edit?.tx?.type === 'adjustment' ? (
            <AdjustmentDetail tx={edit.tx} walletName={wallets.find((w) => w.id === edit.tx?.walletId)?.name} onDone={sheet.close} />
          ) : (
            <TransactionForm
              key={sheet.editId ?? 'new'}
              initialKind={sheet.addKind ?? 'expense'}
              existing={edit?.tx}
              existingFee={edit?.fee}
              wallets={wallets}
              defaultWalletId={defaultWalletId}
              defaultToWalletId={sheet.prefillTo}
              onDone={sheet.close}
            />
          )}
        </>
      )}
    </Sheet>
  )
}

/** Balance adjustments aren't editable like normal transactions; they can only be removed. */
function AdjustmentDetail({ tx, walletName, onDone }: { tx: Transaction; walletName?: string; onDone: () => void }) {
  const remove = async () => {
    const removed = await deleteTransaction(tx.id)
    onDone()
    showToast('Transaksi dihapus', { duration: 5000, action: { label: 'Urungkan', onClick: () => void restoreTransactions(removed) } })
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <p className="label-caps">Penyesuaian saldo · {walletName}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatSignedRupiah(tx.amount)}</p>
        <p className="mt-1 text-sm text-text-muted">{formatDayLong(tx.date)}</p>
        <p className="mt-3 text-xs text-text-muted">Penyesuaian tidak dihitung di chart dan budget.</p>
      </div>
      <button type="button" onClick={remove} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-expense/30 font-semibold text-expense">
        <Trash2 className="size-5" aria-hidden="true" /> Hapus penyesuaian
      </button>
    </div>
  )
}
