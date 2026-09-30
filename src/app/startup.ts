import { checkBudgets } from '../db/budgets'
import { snapshotBeforeMigration } from '../db/migrationBackup'
import { processRecurring } from '../db/recurring'
import { ensureSeeded } from '../db/seed'
import { todayKey } from '../lib/dates'
import { refreshReminders } from '../features/reminders/refresh'
import { syncPushOnOpen } from '../pwa/push'

let started: Promise<void> | null = null

/**
 * Runs once per page load (StrictMode-safe), in the order of PRD §5.3 "every time
 * the app opens" (the PIN lock is handled by the UI before data is shown):
 * migration safety copy → seed → recurring catch-up (FR-7.4) → budgets for the new
 * period → reminders/bell badge → push subscription re-sync (FR-8.11).
 */
export function runStartupTasks(): Promise<void> {
  started ??= (async () => {
    await snapshotBeforeMigration().catch((e) => console.error('Pre-migration snapshot failed', e))
    await ensureSeeded()
    await processRecurring()
    await checkBudgets([todayKey()])
    await refreshReminders()
    // Ask the browser not to evict our data when storage is low (FR-9.5).
    void navigator.storage?.persist?.()
    void syncPushOnOpen()
  })().catch((e) => {
    // Startup work is best-effort; the app must still open.
    console.error('Startup task failed', e)
  })
  return started
}
