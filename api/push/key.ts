import { missingPushConfig } from '../_lib/config.js'
import { json } from '../_lib/http.js'

/**
 * The VAPID public key, so it lives only in Vercel env vars (not in the client
 * build). Also the setup check: 503 lists missing env var names.
 */
export function GET(): Response {
  const missing = missingPushConfig()
  if (missing.length) return json({ error: 'Server push belum dikonfigurasi', missing }, 503)
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY })
}
