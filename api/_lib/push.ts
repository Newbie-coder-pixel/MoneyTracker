import webpush from 'web-push'
import type { PushMessage } from './schedule.js'
import type { PushSubscriptionData } from './store.js'

let configured = false

function configure() {
  if (configured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) throw new Error('VAPID keys are not configured')
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', publicKey, privateKey)
  configured = true
}

export type SendResult = 'sent' | 'gone' | 'failed'

/** 404/410 from the push service means the subscription is dead and must be removed (FR-8.4). */
export async function sendPush(subscription: PushSubscriptionData, message: PushMessage | { kind: 'test'; title: string; body: string; url: string; tag: string }): Promise<SendResult> {
  configure()
  try {
    await webpush.sendNotification(subscription, JSON.stringify(message), { TTL: 60 * 60 * 6, urgency: 'normal' })
    return 'sent'
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    console.error('push failed', status, (e as Error).message)
    return 'failed'
  }
}
