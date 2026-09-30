import { error, isClientId, json, readJson } from '../_lib/http.js'
import { deleteClient } from '../_lib/store.js'

/** POST { pushClientId } */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  if (!body || !isClientId(body.pushClientId)) return error('Body tidak valid', 400)
  await deleteClient(body.pushClientId)
  return json({ ok: true })
}
