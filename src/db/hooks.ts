import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { computeBalances, totalBalance, totalCreditDebt } from '../lib/balance'
import { addDays, todayKey } from '../lib/dates'
import { db } from './schema'
import type { Category, CategoryKind, Transaction, Wallet } from './types'

const byOrder = <T extends { order: number; createdAt: number }>(a: T, b: T) => a.order - b.order || a.createdAt - b.createdAt

/** All wallets (including archived), ordered. */
export function useWallets(): Wallet[] | undefined {
  return useLiveQuery(async () => (await db.wallets.toArray()).sort(byOrder))
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(async () => (await db.categories.toArray()).sort(byOrder))
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useCategories()
  return useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
}

export function useWalletMap(): Map<string, Wallet> {
  const wallets = useWallets()
  return useMemo(() => new Map((wallets ?? []).map((w) => [w.id, w])), [wallets])
}

/**
 * Balances for every wallet, recomputed from all transactions (FR-3.3). A full scan
 * is fine at the PRD's 10k-transaction target (a few ms).
 */
export function useBalances() {
  const data = useLiveQuery(async () => {
    const [wallets, txs] = await Promise.all([db.wallets.toArray(), db.transactions.toArray()])
    return { wallets: wallets.sort(byOrder), txs }
  })
  return useMemo(() => {
    if (!data) return undefined
    const balances = computeBalances(data.wallets, data.txs)
    return {
      wallets: data.wallets,
      balances,
      total: totalBalance(data.wallets, balances),
      creditDebt: totalCreditDebt(data.wallets, balances),
    }
  }, [data])
}

/**
 * Categories of a kind for the add form: active ones, most used in the last 30 days
 * first, then by manual order (FR-1.4).
 */
export function useCategoriesByUsage(kind: CategoryKind): Category[] | undefined {
  return useLiveQuery(async () => {
    const since = addDays(todayKey(), -30)
    const [categories, recent] = await Promise.all([
      db.categories.where('kind').equals(kind).toArray(),
      db.transactions.where('date').aboveOrEqual(since).toArray(),
    ])
    const uses = new Map<string, number>()
    for (const tx of recent) if (tx.categoryId) uses.set(tx.categoryId, (uses.get(tx.categoryId) ?? 0) + 1)
    const isOther = (c: Category) => (c.systemKey === 'other-expense' || c.systemKey === 'other-income' ? 1 : 0)
    return categories
      .filter((c) => !c.archived)
      .sort((a, b) => isOther(a) - isOther(b) || (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || byOrder(a, b))
  }, [kind])
}

export function useTransaction(id: string | null): Transaction | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.transactions.get(id)) ?? null) : null), [id])
}
