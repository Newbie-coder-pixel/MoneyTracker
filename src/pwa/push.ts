import { onManualTransactionSaved } from '../db/events'
import { db } from '../db/schema'
import { getSettings, setSetting } from '../db/settings'
import { upcomingBills } from '../lib/bills'
import { todayKey } from '../lib/dates'
import { isIOS, isStandalone } from './install-prompt'
import { notificationStatus } from './notifications'

/**
 * Web Push client (FR-8). The server only ever receives: the subscription, reminder
 * time, time zone, generic due dates, and "logged on <date>" — never amounts.
 */

const PENDING_LOGGED_KEY = 'mt-pending-logged'
/** How far ahead due dates are sent, so H-1/H-3 reminders arrive even if the app isn't opened. */
const DUE_HORIZON_DAYS = 35

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`/api/push/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

function base64UrlToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Upcoming due dates with generic kinds only (FR-8.5). */
async function dueDates(): Promise<{ date: string; kind: 'bill' | 'credit' }[]> {
  const [recurring, occurrences, wallets, txs] = await Promise.all([
    db.recurring.toArray(),
    db.recurringOccurrences.toArray(),
    db.wallets.toArray(),
    db.transactions.toArray(),
  ])
  const handled = new Set(occurrences.filter((o) => o.status !== 'pending').map((o) => `${o.recurringId}:${o.date}`))
  return upcomingBills({ recurring, handled, cards: wallets, txs }, todayKey(), DUE_HORIZON_DAYS).map((b) => ({
    date: b.date,
    kind: b.kind === 'credit' ? 'credit' : 'bill',
  }))
}

export type EnableResult = { ok: true } | { ok: false; reason: 'unsupported' | 'ios-install' | 'denied' | 'no-sw' | 'server' }

async function register(subscription: PushSubscription, replaceClientId?: string): Promise<boolean> {
  const settings = await getSettings()
  const response = await post('subscribe', {
    subscription: subscription.toJSON(),
    time: settings.dailyReminderTime,
    timezone: timezone(),
    dues: await dueDates(),
    replaceClientId,
  })
  if (!response.ok) return false
  const { pushClientId } = (await response.json()) as { pushClientId: string }
  await setSetting('pushClientId', pushClientId)
  await setSetting('pushEndpoint', subscription.endpoint)
  await setSetting('pushEnabled', true)
  return true
}

async function subscribe(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  const keyResponse = await fetch('/api/push/key')
  if (!keyResponse.ok) return null
  const { publicKey } = (await keyResponse.json()) as { publicKey: string }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
}

/** Must be called from a tap: permission is only asked after the user presses the button (FR-8.2). */
export async function enablePush(): Promise<EnableResult> {
  // iPhone: push only works in the installed PWA on iOS 16.4+ (FR-8.8).
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-install' }
  if (notificationStatus() === 'unsupported' || !('PushManager' in window)) return { ok: false, reason: 'unsupported' }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return { ok: false, reason: 'no-sw' }
  try {
    const subscription = (await registration.pushManager.getSubscription()) ?? (await subscribe(registration))
    if (!subscription) return { ok: false, reason: 'server' }
    const settings = await getSettings()
    return (await register(subscription, settings.pushClientId)) ? { ok: true } : { ok: false, reason: 'server' }
  } catch (e) {
    console.error('Push subscribe failed', e)
    return { ok: false, reason: 'server' }
  }
}

export async function disablePush(): Promise<void> {
  const settings = await getSettings()
  const registration = await navigator.serviceWorker?.getRegistration()
  await (await registration?.pushManager.getSubscription())?.unsubscribe()
  if (settings.pushClientId) await post('unsubscribe', { pushClientId: settings.pushClientId }).catch(() => undefined)
  await setSetting('pushEnabled', false)
  await setSetting('pushClientId', undefined)
  await setSetting('pushEndpoint', undefined)
}

/** Sends the current time, zone and due dates; re-registers if the server forgot us. */
export async function pushUpdate(): Promise<void> {
  const settings = await getSettings()
  if (!settings.pushEnabled || !settings.pushClientId || !navigator.onLine) return
  const response = await post('update', {
    pushClientId: settings.pushClientId,
    time: settings.dailyReminderTime,
    timezone: timezone(),
    dues: await dueDates(),
  })
  if (response.status === 404) {
    const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
    if (subscription) await register(subscription)
  }
}

/**
 * On every open (and after restore / delete-all): make sure the browser's
 * subscription matches the one the server knows, re-registering if it changed or
 * vanished (FR-8.11); then refresh due dates.
 */
export async function syncPushOnOpen(): Promise<void> {
  try {
    void flushLogged()
    const settings = await getSettings()
    if (!settings.pushEnabled || notificationStatus() !== 'granted' || !navigator.onLine) return
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription || subscription.endpoint !== settings.pushEndpoint || !settings.pushClientId) {
      subscription ??= await subscribe(registration)
      if (subscription) await register(subscription, settings.pushClientId)
      return
    }
    await pushUpdate()
  } catch (e) {
    console.error('Push sync failed', e)
  }
}

export async function sendTestPush(): Promise<boolean> {
  const settings = await getSettings()
  if (!settings.pushClientId) return false
  const response = await post('test', { pushClientId: settings.pushClientId })
  return response.ok
}

/** Queues "logged today" and sends it now or when back online (FR-8.3). */
function markLoggedToday(): void {
  try {
    localStorage.setItem(PENDING_LOGGED_KEY, todayKey())
  } catch {
    // Storage blocked: still try to send directly.
  }
  void flushLogged(todayKey())
}

async function flushLogged(date?: string): Promise<void> {
  let pending = date
  try {
    pending ??= localStorage.getItem(PENDING_LOGGED_KEY) ?? undefined
  } catch {
    // ignore
  }
  if (!pending || !navigator.onLine) return
  const settings = await getSettings()
  if (!settings.pushEnabled || !settings.pushClientId) return
  try {
    const response = await post('logged', { pushClientId: settings.pushClientId, date: pending })
    if (response.ok || response.status === 404) localStorage.removeItem(PENDING_LOGGED_KEY)
  } catch {
    // Offline or server down: stays queued.
  }
}

// Card payments and edits change due dates; send them, debounced, after saves.
let updateTimer: number | undefined
export function schedulePushUpdate(): void {
  window.clearTimeout(updateTimer)
  updateTimer = window.setTimeout(() => void pushUpdate().catch(() => undefined), 3000)
}

onManualTransactionSaved(() => {
  markLoggedToday()
  schedulePushUpdate()
})
window.addEventListener('online', () => void flushLogged())
