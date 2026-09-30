import type { Transaction, Wallet } from '../db/types'

type BalanceTx = Pick<Transaction, 'type' | 'amount' | 'walletId' | 'toWalletId' | 'date'>
type BalanceWallet = Pick<Wallet, 'id' | 'initialBalance' | 'initialDate'>

/**
 * Wallet balances derived from transactions — never stored (FR-3.3, PRD §6.2):
 * initial + income + refund + transfer in + adjustment − expense − transfer out,
 * counting only transactions dated on/after the wallet's initialDate.
 */
export function computeBalances(wallets: BalanceWallet[], txs: BalanceTx[]): Map<string, number> {
  const byId = new Map(wallets.map((w) => [w.id, w]))
  const balances = new Map(wallets.map((w) => [w.id, w.initialBalance]))

  const apply = (walletId: string | undefined, delta: number, date: string) => {
    if (!walletId) return
    const wallet = byId.get(walletId)
    if (!wallet || date < wallet.initialDate) return
    balances.set(walletId, (balances.get(walletId) ?? 0) + delta)
  }

  for (const tx of txs) {
    switch (tx.type) {
      case 'expense':
        apply(tx.walletId, -tx.amount, tx.date)
        break
      case 'income':
      case 'refund':
        apply(tx.walletId, tx.amount, tx.date)
        break
      case 'adjustment':
        apply(tx.walletId, tx.amount, tx.date) // signed delta
        break
      case 'transfer':
        apply(tx.walletId, -tx.amount, tx.date)
        apply(tx.toWalletId, tx.amount, tx.date)
        break
    }
  }
  return balances
}

type TotalWallet = Pick<Wallet, 'id' | 'type' | 'includeInTotal' | 'archived'>

/** Sum of active wallets marked "include in total"; negative credit balances reduce it (PRD §6.2). */
export function totalBalance(wallets: TotalWallet[], balances: Map<string, number>): number {
  return wallets
    .filter((w) => w.includeInTotal && !w.archived)
    .reduce((sum, w) => sum + (balances.get(w.id) ?? 0), 0)
}

/** Total credit-card debt as a positive number, shown separately on Beranda. */
export function totalCreditDebt(wallets: TotalWallet[], balances: Map<string, number>): number {
  return wallets
    .filter((w) => w.type === 'credit' && !w.archived)
    .reduce((sum, w) => sum + Math.max(0, -(balances.get(w.id) ?? 0)), 0)
}

/** The signed adjustment needed so the app matches the real balance (FR-3.4). */
export function adjustmentFor(current: number, actual: number): number {
  return actual - current
}
