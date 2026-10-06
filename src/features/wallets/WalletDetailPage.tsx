import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, ArrowLeftRight, CircleMinus, CreditCard, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { IconBadge } from '../../components/IconBadge'
import { AmountInput, ConfirmButton, Field } from '../../components/Pickers'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/toast'
import { useCategoryMap, useWalletMap } from '../../db/hooks'
import { db } from '../../db/schema'
import { compareNewestFirst, createAdjustment } from '../../db/transactions'
import type { Wallet } from '../../db/types'
import { archiveBlocker, archiveWallet, canDeleteWallet, deleteWallet, unarchiveWallet } from '../../db/wallets'
import { adjustmentFor, computeBalances } from '../../lib/balance'
import { cardStatement, limitUsage } from '../../lib/creditCard'
import { formatDayShortYear, todayKey } from '../../lib/dates'
import { formatRupiah, formatSignedRupiah } from '../../lib/money'
import { TransactionRow } from '../transactions/TransactionRow'
import { useTransactionSheet } from '../transactions/useTransactionSheet'
import { walletTypeInfo } from './walletTypes'

export function WalletDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const sheet = useTransactionSheet()
  const categories = useCategoryMap()
  const wallets = useWalletMap()
  const [adjusting, setAdjusting] = useState(false)

  const data = useLiveQuery(async () => {
    const [allWallets, txs] = await Promise.all([db.wallets.toArray(), db.transactions.toArray()])
    const wallet = allWallets.find((w) => w.id === id)
    if (!wallet) return null
    const balance = computeBalances(allWallets, txs).get(id) ?? 0
    const own = txs.filter((t) => t.walletId === id || t.toWalletId === id).sort(compareNewestFirst)
    return {
      wallet,
      balance,
      recent: own.slice(0, 10),
      count: own.length,
      statement: wallet.type === 'credit' ? cardStatement(wallet, txs, todayKey()) : null,
      blocker: wallet.archived ? null : await archiveBlocker(id),
      deletable: await canDeleteWallet(id),
    }
  }, [id])

  if (data === undefined) return <AppHeader title="Dompet" back />
  if (data === null) {
    return (
      <>
        <AppHeader title="Dompet" back />
        <p className="p-8 text-center text-text-muted">Dompet tidak ditemukan.</p>
      </>
    )
  }

  const { wallet, balance, statement } = data
  const isCredit = wallet.type === 'credit'
  const debt = Math.max(0, -balance)

  const run = async (action: () => Promise<void>, message: string, after?: () => void) => {
    try {
      await action()
      showToast(message)
      after?.()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), { tone: 'danger', duration: 5000 })
    }
  }

  return (
    <>
      <AppHeader
        title={wallet.name}
        back
        actions={
          <Link to={`/lainnya/dompet/${wallet.id}/ubah`} aria-label="Ubah dompet" className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface active:bg-surface-muted">
            <Pencil className="size-5" aria-hidden="true" />
          </Link>
        }
      />
      <main className="space-y-4 p-4">
        <section className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <IconBadge icon={wallet.icon} color={wallet.color} size="lg" />
            <div>
              <p className="text-sm text-text-muted">
                {walletTypeInfo(wallet.type).label}
                {wallet.archived ? ' · diarsipkan' : ''}
              </p>
              <p className="label-caps mt-0.5">{isCredit ? 'Utang saat ini' : 'Saldo'}</p>
            </div>
          </div>
          <p className={`mt-3 text-[2rem] leading-10 font-bold tracking-tight ${(isCredit && debt > 0) || (!isCredit && balance < 0) ? 'text-expense' : ''}`}>
            {formatRupiah(isCredit ? debt : balance)}
          </p>
          {!isCredit && balance < 0 && <p className="mt-1 text-sm text-warning">Saldo minus. Cek lagi catatanmu atau sesuaikan saldo.</p>}
        </section>

        {isCredit && (
          <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
            {wallet.creditLimit ? (
              <div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Penggunaan limit</span>
                  <span className={limitUsage(balance, wallet.creditLimit) >= 0.8 ? 'font-semibold text-expense' : 'text-text-muted'}>
                    {Math.round(limitUsage(balance, wallet.creditLimit) * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full ${limitUsage(balance, wallet.creditLimit) >= 0.8 ? 'bg-expense' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, limitUsage(balance, wallet.creditLimit) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  Sisa limit <b className="text-text">{formatRupiah(Math.max(0, wallet.creditLimit - debt))}</b> dari {formatRupiah(wallet.creditLimit)}
                </p>
              </div>
            ) : null}
            {statement ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="label-caps">Tagihan periode terakhir</p>
                  <p className="font-bold tabular-nums">{formatRupiah(statement.billAmount)}</p>
                  <p className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statement.paid ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'}`}>
                    {statement.paid ? 'Lunas' : 'Belum lunas'}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-muted p-3">
                  <p className="label-caps">Jatuh tempo</p>
                  <p className="font-bold">{formatDayShortYear(statement.dueDate)}</p>
                  <p className="mt-1 text-xs text-text-muted">Cetak {formatDayShortYear(statement.statementDate)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">Atur tanggal cetak tagihan dan jatuh tempo di Ubah Dompet.</p>
            )}
          </section>
        )}

        {!wallet.archived && (
          <div className="grid grid-cols-3 gap-2 text-[13px] font-semibold">
            {isCredit ? (
              <ActionButton icon={<CreditCard className="size-5" />} label="Bayar tagihan" onClick={() => sheet.openAdd('transfer', { to: wallet.id })} primary />
            ) : (
              <ActionButton icon={<ArrowLeftRight className="size-5" />} label="Transfer" onClick={() => sheet.openAdd('transfer', { from: wallet.id })} />
            )}
            <ActionButton icon={<CircleMinus className="size-5" />} label="Catat" onClick={() => sheet.openAdd('expense', { from: wallet.id })} />
            <ActionButton icon={<SlidersHorizontal className="size-5" />} label="Sesuaikan" onClick={() => setAdjusting(true)} />
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="flex min-h-12 items-center justify-between border-b border-border px-4">
            <h2 className="label-caps">Transaksi</h2>
            {data.count > 10 && (
              <Link to={`/riwayat?wallet=${wallet.id}`} className="text-sm font-semibold text-accent">
                Semua ({data.count})
              </Link>
            )}
          </div>
          {data.recent.length ? (
            <ul className="divide-y divide-border">
              {data.recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} categories={categories} wallets={wallets} onOpen={sheet.openEdit} />
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-text-muted">Belum ada transaksi di dompet ini.</p>
          )}
        </section>

        <section className="space-y-2">
          {wallet.archived ? (
            <button
              type="button"
              onClick={() => void run(() => unarchiveWallet(wallet.id), 'Dompet dipulihkan')}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface font-semibold"
            >
              <ArchiveRestore className="size-5" aria-hidden="true" /> Pulihkan dari arsip
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!!data.blocker}
                onClick={() => void run(() => archiveWallet(wallet.id), 'Dompet diarsipkan')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface font-semibold disabled:opacity-50"
              >
                <Archive className="size-5" aria-hidden="true" /> Arsipkan
              </button>
              {data.blocker && <p className="px-2 text-xs text-text-muted">{data.blocker}</p>}
            </>
          )}
          {data.deletable && (
            <ConfirmButton
              label={
                <>
                  <Trash2 className="size-5" aria-hidden="true" /> Hapus dompet
                </>
              }
              confirmLabel="Ketuk lagi untuk menghapus"
              onConfirm={() => void run(() => deleteWallet(wallet.id), 'Dompet dihapus', () => navigate('/lainnya/dompet', { replace: true }))}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-expense/30 font-semibold text-expense"
            />
          )}
        </section>
      </main>

      <Sheet open={adjusting} onClose={() => setAdjusting(false)} title="Sesuaikan saldo" subtitle="Samakan saldo aplikasi dengan saldo sebenarnya">
        {adjusting && <AdjustForm wallet={wallet} balance={balance} onDone={() => setAdjusting(false)} />}
      </Sheet>
    </>
  )
}

function ActionButton({ icon, label, onClick, primary }: { icon: ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border ${primary ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface active:bg-surface-muted'}`}
    >
      {icon}
      {label}
    </button>
  )
}

/** FR-3.4: records the difference as an adjustment that charts ignore. */
function AdjustForm({ wallet, balance, onDone }: { wallet: Wallet; balance: number; onDone: () => void }) {
  const isCredit = wallet.type === 'credit'
  // Credit cards: the user enters the real debt (positive).
  const [actual, setActual] = useState(isCredit ? -balance : balance)
  const target = isCredit ? -Math.abs(actual) : actual
  const delta = adjustmentFor(balance, target)

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {isCredit ? 'Utang' : 'Saldo'} di aplikasi: <b className="text-text">{formatRupiah(isCredit ? -balance : balance)}</b>
      </p>
      <Field label={isCredit ? 'Utang sebenarnya' : 'Saldo sebenarnya'}>
        <AmountInput value={actual} onChange={setActual} signed={!isCredit} />
      </Field>
      <p className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
        Penyesuaian: <b className="tabular-nums">{formatSignedRupiah(delta)}</b>
        <span className="block text-xs text-text-muted">Tidak dihitung sebagai pemasukan/pengeluaran di chart.</span>
      </p>
      <button
        type="button"
        disabled={delta === 0}
        onClick={async () => {
          await createAdjustment(wallet.id, delta)
          showToast('Saldo disesuaikan')
          onDone()
        }}
        className="min-h-13 w-full rounded-full bg-primary text-base font-semibold text-on-primary disabled:opacity-50"
      >
        Simpan penyesuaian
      </button>
    </div>
  )
}
