import { showToast } from '../../components/toast'
import type { BudgetAlert } from '../../db/budgets'
import { showLocalNotification } from '../../pwa/notifications'

/** In-app banner plus, when allowed, a device notification (FR-6.4). */
export function announceBudgetAlerts(alerts: BudgetAlert[]): void {
  for (const alert of alerts) {
    const message =
      alert.threshold === 100 ? `Budget ${alert.name} sudah terlampaui` : `Budget ${alert.name} sudah terpakai 80%`
    showToast(message, { tone: alert.threshold === 100 ? 'danger' : 'warning', duration: 5000 })
    void showLocalNotification('Money Tracker', message, '/lainnya/budget')
  }
}
