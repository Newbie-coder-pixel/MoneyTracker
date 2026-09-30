import { todayKey } from '../lib/dates'
import type { Category, Wallet } from './types'
import { db } from './schema'

type SeedCategory = Pick<Category, 'id' | 'name' | 'kind' | 'icon' | 'color' | 'systemKey'>

// Deterministic ids make seeding idempotent (StrictMode double effects, two open tabs).
// Order follows FR-2.2 / FR-2.3.
const EXPENSE: SeedCategory[] = [
  { id: 'cat-food', name: 'Makan & Minum', kind: 'expense', icon: 'utensils', color: '#dc2626' },
  { id: 'cat-transport', name: 'Transportasi', kind: 'expense', icon: 'bike', color: '#0d9488' },
  { id: 'cat-groceries', name: 'Belanja Harian', kind: 'expense', icon: 'shopping-bag', color: '#d97706' },
  { id: 'cat-housing', name: 'Tempat Tinggal', kind: 'expense', icon: 'house', color: '#475569' },
  { id: 'cat-bills', name: 'Tagihan & Utilitas', kind: 'expense', icon: 'receipt', color: '#2563eb' },
  { id: 'cat-phone', name: 'Pulsa & Internet', kind: 'expense', icon: 'wifi', color: '#0891b2' },
  { id: 'cat-fun', name: 'Hiburan & Langganan', kind: 'expense', icon: 'gamepad', color: '#7c3aed' },
  { id: 'cat-health', name: 'Kesehatan', kind: 'expense', icon: 'heart-pulse', color: '#db2777' },
  { id: 'cat-education', name: 'Pendidikan', kind: 'expense', icon: 'graduation-cap', color: '#4f46e5' },
  { id: 'cat-care', name: 'Perawatan Diri & Pakaian', kind: 'expense', icon: 'shirt', color: '#c026d3' },
  { id: 'cat-social', name: 'Sosial & Hadiah', kind: 'expense', icon: 'gift', color: '#ea580c' },
  { id: 'cat-debt', name: 'Cicilan & Utang', kind: 'expense', icon: 'credit-card', color: '#65a30d' },
  { id: 'cat-admin-fee', name: 'Biaya Admin', kind: 'expense', icon: 'landmark', color: '#78716c', systemKey: 'admin-fee' },
  { id: 'cat-other-expense', name: 'Lainnya', kind: 'expense', icon: 'ellipsis', color: '#78716c', systemKey: 'other-expense' },
]

const INCOME: SeedCategory[] = [
  { id: 'cat-salary', name: 'Gaji', kind: 'income', icon: 'briefcase', color: '#059669' },
  { id: 'cat-bonus', name: 'Bonus', kind: 'income', icon: 'sparkles', color: '#d97706' },
  { id: 'cat-freelance', name: 'Freelance & Usaha', kind: 'income', icon: 'laptop', color: '#2563eb' },
  { id: 'cat-gift-income', name: 'Hadiah', kind: 'income', icon: 'gift', color: '#db2777' },
  { id: 'cat-other-income', name: 'Lainnya', kind: 'income', icon: 'ellipsis', color: '#78716c', systemKey: 'other-income' },
]

export const CASH_WALLET_ID = 'wallet-cash'

export function defaultCategories(now = Date.now()): Category[] {
  return [...EXPENSE, ...INCOME].map((c, i) => ({ ...c, isDefault: true, archived: false, order: i, createdAt: now }))
}

export function defaultCashWallet(now = Date.now()): Wallet {
  return {
    id: CASH_WALLET_ID,
    name: 'Cash',
    type: 'cash',
    color: '#059669',
    icon: 'banknote',
    initialBalance: 0,
    initialDate: todayKey(),
    includeInTotal: true,
    archived: false,
    order: 0,
    createdAt: now,
  }
}

/** Seeds default categories and the Cash wallet on first run (FR-2.2, FR-2.3, FR-3.6). */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.categories, db.wallets, async () => {
    if ((await db.categories.count()) === 0) await db.categories.bulkPut(defaultCategories())
    if ((await db.wallets.count()) === 0) await db.wallets.put(defaultCashWallet())
  })
}
