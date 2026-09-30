import { error, json } from '../_lib/http.js'
import { sendPush } from '../_lib/push.js'
import { decide } from '../_lib/schedule.js'
import { deleteClient, getClient, listClientIds, putClient } from '../_lib/store.js'

/**
 * GET, called every 15 minutes by a scheduler with `Authorization: Bearer <CRON_SECRET>`
 * (FR-8.4). Sends due reminders and drops subscriptions the push service rejects.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return error('Unauthorized', 401)

  const now = new Date()
  let sent = 0
  let removed = 0
  for (const id of await listClientIds()) {
    const record = await getClient(id)
    if (!record) {
      await deleteClient(id)
      continue
    }
    const { messages, next } = decide(record, now)
    let gone = false
    for (const message of messages) {
      const result = await sendPush(record.subscription, message)
      if (result === 'gone') {
        gone = true
        break
      }
      if (result === 'sent') sent++
    }
    if (gone) {
      await deleteClient(id)
      removed++
    } else if (messages.length || next.dues.length !== record.dues.length) {
      await putClient(id, { ...record, ...next, updatedAt: Date.now() })
    }
  }
  return json({ ok: true, sent, removed })
}
