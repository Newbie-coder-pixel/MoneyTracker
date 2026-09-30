/**
 * Names of required env vars that are missing. Only names are exposed (never
 * values), so the app can tell the owner exactly what to set in Vercel.
 */
export function missingPushConfig(): string[] {
  const missing: string[] = []
  if (!process.env.VAPID_PUBLIC_KEY) missing.push('VAPID_PUBLIC_KEY')
  if (!process.env.VAPID_PRIVATE_KEY) missing.push('VAPID_PRIVATE_KEY')
  if (!(process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)) missing.push('UPSTASH_REDIS_REST_URL')
  if (!(process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)) missing.push('UPSTASH_REDIS_REST_TOKEN')
  return missing
}
