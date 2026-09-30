import Dexie from 'dexie'
import { addDays, todayKey } from '../lib/dates'
import { dueDates } from '../lib/recurring'
import { checkBudgets } from './budgets'
import { newId } from './ids'
import { db } from './schema'
import type { DateKey, Recurring, RecurringOccurrence, Transaction } from './types'

/** Generated transactions get a fixed early time so they sort below what the user logs that day. */
const GENERATED_TIME = '00:00'

function transactionFromTemplate(r: Recurring, date: DateKey, amount: number, now: number): Transaction {
  const t = r.template
  return {
    id: newId(),
    type: t.type,
    amount,
    categoryId: t.type === 'transfer' ? undefined : t.categoryId,
    walletId: t.walletId,
    toWalletId: t.type === 'transfer' ? t.toWalletId : undefined,
    date,
    time: GENERATED_TIME,
    note: t.note || r.name,
    recurringId: r.id,
    occurrenceDate: date,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Catch-up on app open (FR-7.4): creates every occurrence since the last run.
 * The unique [recurringId+date] index makes this safe to run twice (two tabs,
 * StrictMode): any existing occurrence — pending, done or skipped — is left alone.
 */
export async function processRecurring(today = todayKey()): Promise<{ created: number; pending: number }> {
  const schedules = await db.recurring.toArray()
  const touchedDates: DateKey[] = []
  let created = 0
  let pending = 0

  for (const r of schedules) {
    // Paused schedules skip the dates they were paused for instead of catching up later (FR-7.6).
    const dates = r.paused ? [] : dueDates(r, today)
    for (const date of dates) {
      try {
        await db.transaction('rw', db.recurringOccurrences, db.transactions, async () => {
          const exists = await db.recurringOccurrences.where('[recurringId+date]').equals([r.id, date]).count()
          if (exists) return
          const now = Date.now()
          const occurrence: RecurringOccurrence = { id: newId(), recurringId: r.id, date, status: 'pending', createdAt: now, updatedAt: now }
          if (r.mode === 'auto') {
            const tx = transactionFromTemplate(r, date, r.template.amount, now)
            await db.transactions.add(tx)
            occurrence.status = 'done'
            occurrence.transactionId = tx.id
            touchedDates.push(date)
            created++
          } else {
            pending++
          }
          await db.recurringOccurrences.add(occurrence)
        })
      } catch (e) {
        // Another tab won the race for this occurrence.
        if (!(e instanceof Dexie.ConstraintError)) throw e
      }
    }
    if (!r.lastProcessedDate || r.lastProcessedDate < today) {
      await db.recurring.update(r.id, { lastProcessedDate: today })
    }
  }

  if (touchedDates.length) await checkBudgets(touchedDates)
  return { created, pending }
}

/** "Catat" / "Ubah nominal" on a pending occurrence (FR-7.3). */
export async function confirmOccurrence(occurrenceId: string, amountOverride?: number): Promise<void> {
  let date: DateKey | undefined
  await db.transaction('rw', db.recurringOccurrences, db.recurring, db.transactions, async () => {
    const occ = await db.recurringOccurrences.get(occurrenceId)
    if (!occ || occ.status !== 'pending') return
    const r = await db.recurring.get(occ.recurringId)
    if (!r) return
    const now = Date.now()
    const tx = transactionFromTemplate(r, occ.date, amountOverride ?? r.template.amount, now)
    await db.transactions.add(tx)
    await db.recurringOccurrences.update(occ.id, { status: 'done', transactionId: tx.id, amountOverride, updatedAt: now })
    date = occ.date
  })
  if (date) await checkBudgets([date])
}

/** "Lewati" (FR-7.3). */
export async function skipOccurrence(occurrenceId: string): Promise<void> {
  await db.recurringOccurrences.update(occurrenceId, { status: 'skipped', updatedAt: Date.now() })
}

export type RecurringDraft = Omit<Recurring, 'id' | 'createdAt' | 'lastProcessedDate' | 'paused'>

/**
 * Creating starts processing from startDate. Editing only affects future
 * occurrences; recorded transactions stay as they were (FR-7.8).
 */
export async function saveRecurring(draft: RecurringDraft, existingId?: string): Promise<string> {
  if (existingId) {
    await db.recurring.update(existingId, { ...draft })
    return existingId
  }
  const id = newId()
  await db.recurring.add({ ...draft, id, paused: false, createdAt: Date.now() })
  return id
}

export async function setRecurringPaused(id: string, paused: boolean): Promise<void> {
  // Resuming continues from today: dates during the pause aren't created, today's still is.
  await db.recurring.update(id, paused ? { paused } : { paused, lastProcessedDate: addDays(todayKey(), -1) })
}

/** Deletes the schedule and its pending occurrences; recorded transactions stay. */
export async function deleteRecurring(id: string): Promise<void> {
  await db.transaction('rw', db.recurring, db.recurringOccurrences, async () => {
    await db.recurringOccurrences.where('recurringId').equals(id).filter((o) => o.status === 'pending').delete()
    await db.recurring.delete(id)
  })
}
