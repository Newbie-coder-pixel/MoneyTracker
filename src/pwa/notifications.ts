export type NotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported'

export function notificationStatus(): NotificationStatus {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission
}

/**
 * Local notification via the service worker (FR-8.6) — no server involved. Silently
 * does nothing without permission; the in-app banner/toast is always shown anyway.
 */
export async function showLocalNotification(title: string, body: string, url = '/'): Promise<void> {
  if (notificationStatus() !== 'granted') return
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) return
  await registration.showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/badge-96x96.png', data: { url }, tag: url })
}
