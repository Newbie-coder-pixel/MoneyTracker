/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// __WB_MANIFEST is replaced at build time by vite-plugin-pwa (injectManifest).
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (PrecacheEntry | string)[] }

// Offline-first (PRD §1): the whole app shell is precached; every navigation is
// served index.html so all routes work in airplane mode.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

// A new version waits until the user taps "Muat ulang" (FR-10.6).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

interface PushPayload {
  title?: string
  body?: string
  /** In-app path to open on tap. */
  url?: string
  tag?: string
  /** Daily reminders get the "Catat sekarang" action (FR-8.7). */
  kind?: 'daily' | 'bill' | 'credit' | 'test'
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  const url = data.url ?? (data.kind === 'daily' ? '/?add=expense' : '/')
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Money Tracker', {
      body: data.body ?? 'Sudah catat pengeluaran hari ini?',
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      tag: data.tag ?? data.kind ?? 'money-tracker',
      data: { url },
      // `actions` is supported on Android Chrome; other platforms ignore it.
      ...(data.kind === 'daily' ? { actions: [{ action: 'add', title: 'Catat sekarang' }] } : {}),
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.action === 'add' ? '/?add=expense' : ((event.notification.data as { url?: string } | null)?.url ?? '/')
  event.waitUntil(
    (async () => {
      const url = new URL(target, self.location.origin).href
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) {
        await existing.focus()
        await existing.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
