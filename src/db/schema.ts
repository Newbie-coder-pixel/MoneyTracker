import Dexie, { type EntityTable } from 'dexie'
import type {
  Budget,
  Category,
  Recurring,
  RecurringOccurrence,
  Reminder,
  SettingRow,
  Transaction,
  Wallet,
} from './types'

/** Bump together with a new `db.version(n)` block; stored in backups (FR-9.1). */
export const SCHEMA_VERSION = 1

export class MoneyTrackerDB extends Dexie {
  wallets!: EntityTable<Wallet, 'id'>
  categories!: EntityTable<Category, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  recurring!: EntityTable<Recurring, 'id'>
  recurringOccurrences!: EntityTable<RecurringOccurrence, 'id'>
  reminders!: EntityTable<Reminder, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name = 'money-tracker') {
    super(name)
    // Booleans (archived, paused) aren't valid IndexedDB keys, so they're filtered in memory.
    // `&` marks a unique index: [recurringId+date] is the recurring dedup guard (PRD §6.2, §8.4).
    this.version(1).stores({
      wallets: 'id',
      categories: 'id, kind',
      transactions: 'id, date, [type+date], categoryId, walletId, toWalletId, recurringId, linkedId, createdAt',
      budgets: 'id, period, &[period+categoryId]',
      recurring: 'id',
      recurringOccurrences: 'id, recurringId, status, &[recurringId+date]',
      reminders: 'id, status, dueAt, [kind+refId]',
      settings: 'key',
    })
    // Migrations: add `this.version(2).stores({...}).upgrade(tx => ...)` below and bump
    // SCHEMA_VERSION. Take a pre-migration backup first for structural changes (FR-10.6).
  }
}

export const db = new MoneyTrackerDB()

export const ALL_TABLES = [
  'wallets',
  'categories',
  'transactions',
  'budgets',
  'recurring',
  'recurringOccurrences',
  'reminders',
  'settings',
] as const

export type TableName = (typeof ALL_TABLES)[number]
