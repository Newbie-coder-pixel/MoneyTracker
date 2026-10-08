/** Local calendar date, `YYYY-MM-DD`. Never a UTC timestamp (PRD §8.4). */
export type DateKey = string
/** Local time, `HH:mm`. */
export type TimeKey = string

export type WalletType = 'cash' | 'ewallet' | 'bank' | 'credit'

export interface Wallet {
  id: string
  name: string
  type: WalletType
  color: string
  icon: string
  /** Integer Rupiah. For credit cards a debt is negative. */
  initialBalance: number
  initialDate: DateKey
  includeInTotal: boolean
  /** Credit cards only (FR-3.7). */
  creditLimit?: number
  statementDay?: number
  dueDay?: number
  archived: boolean
  order: number
  createdAt: number
}

export type CategoryKind = 'expense' | 'income'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  icon: string
  color: string
  isDefault: boolean
  /** Built-in categories with special rules ("Lainnya", "Biaya Admin"). */
  systemKey?: 'other-expense' | 'other-income' | 'admin-fee'
  archived: boolean
  order: number
  createdAt: number
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment' | 'refund'

export interface Transaction {
  id: string
  type: TransactionType
  /**
   * Integer Rupiah, always > 0 — except `adjustment`, which is the signed
   * difference applied to the wallet (FR-3.4).
   */
  amount: number
  /** Required for expense/income; for refund it is the original expense category (FR-1.9). */
  categoryId?: string
  /** Source wallet; for income/refund/adjustment the wallet that receives the change. */
  walletId: string
  /** Transfer destination. */
  toWalletId?: string
  date: DateKey
  time: TimeKey
  note: string
  recurringId?: string
  /** Back-link to the schedule occurrence; not unique (dedup lives in recurringOccurrences). */
  occurrenceDate?: DateKey
  /** Admin-fee expense created alongside a transfer points to the transfer (FR-1.5). */
  linkedId?: string
  createdAt: number
  updatedAt: number
}

/** Budget row for the whole month instead of one category. */
export const TOTAL_BUDGET_ID = '__total__'

export interface Budget {
  id: string
  /** Category id, or TOTAL_BUDGET_ID. (Not null: null can't be part of an IndexedDB compound key.) */
  categoryId: string
  /** `YYYY-MM`, named after the month the period starts in (PRD §6.2). */
  period: string
  amount: number
  autoRepeat: boolean
  alerted80: boolean
  alerted100: boolean
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTemplate {
  type: 'expense' | 'income' | 'transfer'
  amount: number
  categoryId?: string
  walletId: string
  toWalletId?: string
  note: string
}

export interface Recurring {
  id: string
  /** Display name, e.g. "Kos". */
  name: string
  template: RecurringTemplate
  frequency: Frequency
  /** Every N days/weeks/months/years. */
  interval: number
  /** Weekly: ISO weekday 1 (Mon) – 7 (Sun). */
  dayOfWeek?: number
  /** Monthly/yearly: 1–31; clamps to the month's last day. */
  dayOfMonth?: number
  /** Yearly: 1–12. */
  monthOfYear?: number
  startDate: DateKey
  endDate?: DateKey
  maxCount?: number
  mode: 'auto' | 'confirm'
  paused: boolean
  /** Last date the catch-up has handled (inclusive). */
  lastProcessedDate?: DateKey
  createdAt: number
}

export type OccurrenceStatus = 'pending' | 'done' | 'skipped'

export interface RecurringOccurrence {
  id: string
  recurringId: string
  date: DateKey
  status: OccurrenceStatus
  transactionId?: string
  amountOverride?: number
  createdAt: number
  updatedAt: number
}

export type ReminderKind = 'daily' | 'bill' | 'credit' | 'budget' | 'backup'

export interface Reminder {
  id: string
  kind: ReminderKind
  /** Budget/recurring/wallet id the reminder is about; with kind it makes the reminder idempotent. */
  refId: string
  title: string
  body: string
  /** Epoch ms when it becomes visible. */
  dueAt: number
  status: 'active' | 'done' | 'dismissed'
  /** In-app route to open, e.g. `/lainnya/budget`. */
  link?: string
  createdAt: number
}

export interface Settings {
  monthStartDay: number
  hideBalance: boolean
  dailyReminderTime: TimeKey
  pinHash?: string
  pinSalt?: string
  /** WebAuthn credential id (base64url) for Face ID / fingerprint unlock; only used while a PIN is set. */
  biometricCredentialId?: string
  lastBackupAt?: number
  /** Backup banner hidden until this epoch ms ("Nanti saja"). */
  backupSnoozedUntil?: number
  onboarded: boolean
  pushEnabled: boolean
  pushClientId?: string
  /** Endpoint registered on the server, to notice when the browser's subscription changes (FR-8.11). */
  pushEndpoint?: string
  /** Last date the app ran recurring catch-up, for diagnostics. */
  lastOpenedDate?: DateKey
  /** Last used wallet, the default in the add form (FR-1.4). */
  lastWalletId?: string
  /** Set after the user has seen the "install to home screen" hint. */
  installHintDismissed?: boolean
}

export type SettingKey = keyof Settings

export interface SettingRow<K extends SettingKey = SettingKey> {
  key: K
  value: Settings[K]
}
