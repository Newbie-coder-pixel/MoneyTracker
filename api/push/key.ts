import { error, json } from '../_lib/http.js'

/** The VAPID public key, so it lives only in Vercel env vars (not in the client build). */
export function GET(): Response {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  if (!publicKey) return error('Push belum dikonfigurasi di server', 503)
  return json({ publicKey })
}
