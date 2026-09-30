import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { ToastViewport } from '../components/ToastViewport'
import { useSettings } from '../db/settings'
import { Onboarding } from '../features/onboarding/Onboarding'
import { refreshReminders } from '../features/reminders/refresh'
import { useLocked } from '../features/security/lockState'
import { PinLockScreen } from '../features/security/PinLockScreen'
import { TransactionSheet } from '../features/transactions/TransactionSheet'
import { UpdateBanner } from '../pwa/UpdateBanner'
import { runStartupTasks } from './startup'

/** How often an open app re-checks due reminders (the daily one becomes due at a set time). */
const REMINDER_REFRESH_MS = 5 * 60 * 1000

/**
 * Wraps every route: startup tasks, then PIN lock (FR-10.2) → onboarding (FR-10.4)
 * → the app with its transaction sheet (?add= / ?edit=) and toasts.
 */
export function RootLayout() {
  const [ready, setReady] = useState(false)
  const settings = useSettings()
  const locked = useLocked()

  useEffect(() => {
    let cancelled = false
    runStartupTasks().finally(() => !cancelled && setReady(true))
    const timer = setInterval(() => void refreshReminders(), REMINDER_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (!ready || !settings) return <div className="min-h-dvh bg-bg" aria-busy="true" />
  if (settings.pinHash && locked) return <PinLockScreen settings={settings} />
  if (!settings.onboarded) return <Onboarding />

  return (
    <>
      <Outlet />
      <TransactionSheet />
      <ToastViewport />
      <UpdateBanner />
    </>
  )
}
