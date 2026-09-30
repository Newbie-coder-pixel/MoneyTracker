import { error, isClientId, json, parseSubscription, readJson } from '../_lib/http.js'
import { isValidTime, isValidTimezone, parseDues } from '../_lib/schedule.js'
import { clientCount, deleteClient, MAX_CLIENTS, putClient } from '../_lib/store.js'

/**
 * POST { subscription, time, timezone, dues?, replaceClientId? } → { pushClientId }
 * (FR-8.2). A re-registration (FR-8.11) passes the old id so it is removed.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  if (!body) return error('Body tidak valid', 400)
  const subscription = parseSubscription(body.subscription)
  if (!subscription) return error('Subscription tidak valid', 400)
  if (!isValidTime(body.time)) return error('Jam tidak valid', 400)
  if (!isValidTimezone(body.timezone)) return error('Zona waktu tidak valid', 400)

  if (isClientId(body.replaceClientId)) await deleteClient(body.replaceClientId)
  if ((await clientCount()) >= MAX_CLIENTS) return error('Batas perangkat tercapai', 429)

  const id = crypto.randomUUID()
  const now = Date.now()
  await putClient(id, {
    subscription,
    time: body.time,
    timezone: body.timezone,
    dues: parseDues(body.dues),
    sentDues: [],
    lastLogged: undefined,
    createdAt: now,
    updatedAt: now,
  })
  return json({ pushClientId: id }, 201)
}
