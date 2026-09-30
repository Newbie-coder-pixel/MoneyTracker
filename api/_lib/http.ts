import type { PushSubscriptionData } from './store.js'

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export const error = (message: string, status: number) => json({ error: message }, status)

const MAX_BODY = 16 * 1024

/** Parses a small JSON body; null when missing, too big or malformed. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text()
  if (!text || text.length > MAX_BODY) return null
  try {
    const value: unknown = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isClientId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id)

// Only real push services, so the server can't be used to call arbitrary URLs.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/]

export function parseSubscription(value: unknown): PushSubscriptionData | null {
  const sub = value as Partial<PushSubscriptionData> | null
  if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1024) return null
  if (typeof sub.keys?.p256dh !== 'string' || typeof sub.keys?.auth !== 'string') return null
  let url: URL
  try {
    url = new URL(sub.endpoint)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.some((re) => re.test(url.hostname))) return null
  return { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }
}
