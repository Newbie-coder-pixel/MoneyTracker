import { error, isClientId, json, readJson } from '../_lib/http.js'
import { isValidDate } from '../_lib/schedule.js'
import { getClient, putClient } from '../_lib/store.js'

/** POST { pushClientId, date } — "already logged today", with no amount or category (FR-8.3). */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  if (!body || !isClientId(body.pushClientId) || !isValidDate(body.date)) return error('Body tidak valid', 400)
  const record = await getClient(body.pushClientId)
  if (!record) return error('Tidak terdaftar', 404)
  if (!record.lastLogged || body.date > record.lastLogged) {
    record.lastLogged = body.date
    record.updatedAt = Date.now()
    await putClient(body.pushClientId, record)
  }
  return json({ ok: true })
}
