import { error, isClientId, json, readJson } from '../_lib/http.js'
import { isValidTime, isValidTimezone, parseDues } from '../_lib/schedule.js'
import { getClient, putClient } from '../_lib/store.js'

/** POST { pushClientId, time?, timezone?, dues? } — 404 tells the app to re-register (FR-8.11). */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  if (!body || !isClientId(body.pushClientId)) return error('Body tidak valid', 400)
  const record = await getClient(body.pushClientId)
  if (!record) return error('Tidak terdaftar', 404)

  if (body.time !== undefined) {
    if (!isValidTime(body.time)) return error('Jam tidak valid', 400)
    // A new time today should still be able to fire today.
    if (body.time !== record.time) record.lastDailySent = undefined
    record.time = body.time
  }
  if (body.timezone !== undefined) {
    if (!isValidTimezone(body.timezone)) return error('Zona waktu tidak valid', 400)
    record.timezone = body.timezone
  }
  if (body.dues !== undefined) record.dues = parseDues(body.dues)
  record.updatedAt = Date.now()
  await putClient(body.pushClientId, record)
  return json({ ok: true })
}
