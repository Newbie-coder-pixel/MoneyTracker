import { error, isClientId, json, readJson } from '../_lib/http.js'
import { sendPush } from '../_lib/push.js'
import { deleteClient, getClient } from '../_lib/store.js'

/** POST { pushClientId } — "Kirim notifikasi uji" (FR-8.9). */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request)
  if (!body || !isClientId(body.pushClientId)) return error('Body tidak valid', 400)
  const record = await getClient(body.pushClientId)
  if (!record) return error('Tidak terdaftar', 404)
  const result = await sendPush(record.subscription, {
    kind: 'test',
    title: 'Money Tracker',
    body: 'Notifikasi uji berhasil. Pengingat harian akan muncul seperti ini.',
    url: '/pengingat',
    tag: 'test',
  })
  if (result === 'gone') {
    await deleteClient(body.pushClientId)
    return error('Subscription kedaluwarsa', 410)
  }
  return result === 'sent' ? json({ ok: true }) : error('Gagal mengirim', 502)
}
