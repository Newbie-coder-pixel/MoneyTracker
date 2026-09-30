import { newId } from './ids'
import { db } from './schema'
import type { Reminder } from './types'

export type ReminderInput = Pick<Reminder, 'kind' | 'refId' | 'title' | 'body' | 'dueAt'> & Pick<Partial<Reminder>, 'link'>

/**
 * Creates the reminder, or refreshes it if one with the same kind+refId exists.
 * A reminder the user already dismissed/completed stays that way.
 */
export async function upsertReminder(input: ReminderInput): Promise<void> {
  await db.transaction('rw', db.reminders, async () => {
    const existing = await db.reminders.where('[kind+refId]').equals([input.kind, input.refId]).first()
    if (existing) {
      if (existing.status === 'active') await db.reminders.update(existing.id, { ...input })
      return
    }
    await db.reminders.add({ ...input, id: newId(), status: 'active', createdAt: Date.now() })
  })
}

export async function setReminderStatus(id: string, status: Reminder['status']): Promise<void> {
  await db.reminders.update(id, { status })
}

/** Removes active reminders of a kind whose refId is no longer relevant (e.g. a paid bill). */
export async function clearReminders(kind: Reminder['kind'], keepRefIds: Set<string>): Promise<void> {
  const rows = await db.reminders.where('status').equals('active').filter((r) => r.kind === kind).toArray()
  const stale = rows.filter((r) => !keepRefIds.has(r.refId)).map((r) => r.id)
  if (stale.length) await db.reminders.bulkDelete(stale)
}
