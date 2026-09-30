import { toTimeKey, todayKey } from '../lib/dates'
import { validateTransaction } from '../lib/validation'
import { checkBudgets, type BudgetAlert } from './budgets'
import { emitManualTransactionSaved } from './events'
import { newId } from './ids'
import { db } from './schema'
import { setSetting } from './settings'
import type { DateKey, TimeKey, Transaction, TransactionType } from './types'

export const ADMIN_FEE_CATEGORY_ID = 'cat-admin-fee'

export interface TransactionDraft {
  type: Exclude<TransactionType, 'adjustment'>
  amount: number
  categoryId?: string
  walletId: string
  toWalletId?: string
  date: DateKey
  time: TimeKey
  note: string
  /** Transfer only: optional admin fee, stored as a linked "Biaya Admin" expense (FR-1.5). */
  adminFee?: number
}

export interface SaveResult {
  id: string
  alerts: BudgetAlert[]
}

export class ValidationError extends Error {}

/** Creates or updates a transaction (and its admin-fee expense), then re-checks budgets. */
export async function saveTransaction(draft: TransactionDraft, existingId?: string): Promise<SaveResult> {
  const error = validateTransaction(draft)
  if (error) throw new ValidationError(error)

  const now = Date.now()
  const id = existingId ?? newId()
  let previousDate: DateKey | undefined

  await db.transaction('rw', db.transactions, db.settings, async () => {
    const previous = existingId ? await db.transactions.get(existingId) : undefined
    previousDate = previous?.date
    const isTransfer = draft.type === 'transfer'

    const row: Transaction = {
      id,
      type: draft.type,
      amount: draft.amount,
      categoryId: isTransfer ? undefined : draft.categoryId,
      walletId: draft.walletId,
      toWalletId: isTransfer ? draft.toWalletId : undefined,
      date: draft.date,
      time: draft.time,
      note: draft.note.trim(),
      // Editing a generated transaction keeps its schedule link (FR-7.5).
      recurringId: previous?.recurringId,
      occurrenceDate: previous?.occurrenceDate,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }
    await db.transactions.put(row)

    await db.transactions.where('linkedId').equals(id).delete()
    if (isTransfer && draft.adminFee && draft.adminFee > 0) {
      await db.transactions.add({
        id: newId(),
        type: 'expense',
        amount: draft.adminFee,
        categoryId: ADMIN_FEE_CATEGORY_ID,
        walletId: draft.walletId,
        date: draft.date,
        time: draft.time,
        note: 'Biaya admin transfer',
        linkedId: id,
        createdAt: now,
        updatedAt: now,
      })
    }
    await setSetting('lastWalletId', draft.walletId)
  })

  emitManualTransactionSaved()
  return { id, alerts: await checkBudgets([previousDate, draft.date]) }
}

/** Deletes a transaction and its linked admin fee; returns the rows so the toast can undo (FR-1.6). */
export async function deleteTransaction(id: string): Promise<Transaction[]> {
  const removed = await db.transaction('rw', db.transactions, async () => {
    const tx = await db.transactions.get(id)
    if (!tx) return []
    const linked = await db.transactions.where('linkedId').equals(id).toArray()
    await db.transactions.bulkDelete([id, ...linked.map((l) => l.id)])
    return [tx, ...linked]
  })
  // The recurring occurrence stays, so catch-up won't recreate it (FR-7.8).
  await checkBudgets(removed.map((t) => t.date))
  return removed
}

export async function restoreTransactions(rows: Transaction[]): Promise<void> {
  await db.transactions.bulkPut(rows)
  await checkBudgets(rows.map((t) => t.date))
}

/** Same transaction again, today at the current time (FR-1.7). */
export async function duplicateTransaction(id: string): Promise<SaveResult | null> {
  const tx = await db.transactions.get(id)
  if (!tx || tx.type === 'adjustment') return null
  const fee = tx.type === 'transfer' ? await db.transactions.where('linkedId').equals(id).first() : undefined
  const now = new Date()
  return saveTransaction({
    type: tx.type,
    amount: tx.amount,
    categoryId: tx.categoryId,
    walletId: tx.walletId,
    toWalletId: tx.toWalletId,
    date: todayKey(now),
    time: toTimeKey(now),
    note: tx.note,
    adminFee: fee?.amount,
  })
}

/** Records the difference between app and real balance; excluded from charts (FR-3.4). */
export async function createAdjustment(walletId: string, delta: number, note = 'Penyesuaian saldo'): Promise<void> {
  if (delta === 0) return
  const now = new Date()
  await db.transactions.add({
    id: newId(),
    type: 'adjustment',
    amount: delta,
    walletId,
    date: todayKey(now),
    time: toTimeKey(now),
    note,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  })
}

/** Deterministic order: date, then time, then createdAt — newest first (FR-4.2). */
export function compareNewestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.time !== b.time) return a.time < b.time ? 1 : -1
  return b.createdAt - a.createdAt
}
