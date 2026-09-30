import { computeBalances } from '../lib/balance'
import { newId } from './ids'
import { db } from './schema'
import type { Wallet } from './types'

export type WalletDraft = Omit<Wallet, 'id' | 'createdAt' | 'archived' | 'order'>

export async function saveWallet(draft: WalletDraft, existingId?: string): Promise<string> {
  if (!draft.name.trim()) throw new Error('Nama dompet wajib diisi')
  const clean: WalletDraft = {
    ...draft,
    name: draft.name.trim(),
    // Only credit cards carry limit and billing days (FR-3.7).
    ...(draft.type === 'credit' ? {} : { creditLimit: undefined, statementDay: undefined, dueDay: undefined }),
  }
  if (existingId) {
    await db.wallets.update(existingId, clean)
    return existingId
  }
  const id = newId()
  const order = (await db.wallets.count()) + 1
  await db.wallets.add({ ...clean, id, archived: false, order, createdAt: Date.now() })
  return id
}

async function walletHasTransactions(id: string): Promise<boolean> {
  return (await db.transactions.where('walletId').equals(id).count()) > 0 || (await db.transactions.where('toWalletId').equals(id).count()) > 0
}

async function balanceOf(id: string): Promise<number> {
  const [wallets, txs] = await Promise.all([db.wallets.toArray(), db.transactions.toArray()])
  return computeBalances(wallets, txs).get(id) ?? 0
}

async function activeCount(): Promise<number> {
  return (await db.wallets.toArray()).filter((w) => !w.archived).length
}

/** Why a wallet can't be archived right now, or null (FR-3.8). */
export async function archiveBlocker(id: string): Promise<string | null> {
  const wallet = await db.wallets.get(id)
  if (!wallet) return 'Dompet tidak ditemukan'
  if ((await activeCount()) <= 1) return 'Minimal harus ada satu dompet aktif'
  const balance = await balanceOf(id)
  if (wallet.type === 'credit' && balance < 0) return 'Lunasi utang kartu ini dulu sebelum diarsipkan'
  if (balance !== 0) return 'Pindahkan saldo (transfer) atau sesuaikan jadi Rp 0 dulu sebelum diarsipkan'
  return null
}

export async function archiveWallet(id: string): Promise<void> {
  const blocker = await archiveBlocker(id)
  if (blocker) throw new Error(blocker)
  await db.wallets.update(id, { archived: true })
}

export async function unarchiveWallet(id: string): Promise<void> {
  await db.wallets.update(id, { archived: false })
}

/** Only wallets without any transaction can be deleted; others are archived (FR-3.8). */
export async function canDeleteWallet(id: string): Promise<boolean> {
  return !(await walletHasTransactions(id)) && (await db.recurring.filter((r) => r.template.walletId === id || r.template.toWalletId === id).count()) === 0
}

export async function deleteWallet(id: string): Promise<void> {
  if (!(await canDeleteWallet(id))) throw new Error('Dompet sudah punya transaksi atau jadwal rutin; arsipkan saja')
  const wallet = await db.wallets.get(id)
  if (wallet && !wallet.archived && (await activeCount()) <= 1) throw new Error('Minimal harus ada satu dompet aktif')
  await db.wallets.delete(id)
}
