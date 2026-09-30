import { onManualTransactionSaved } from '../../db/events'
import { clearReminders, upsertReminder } from '../../db/reminders'
import { db } from '../../db/schema'
import { getSettings } from '../../db/settings'
import { upcomingBills } from '../../lib/bills'
import { addDays, dateFromKey, formatDayShort, todayKey } from '../../lib/dates'
import { formatRupiah } from '../../lib/money'

/** Local epoch ms for a date at HH:mm. */
function at(date: string, time: string): number {
  const d = dateFromKey(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/**
 * Rebuilds the in-app reminder center (FR-8.10), which works even without push:
 * bills H-1/H, credit cards H-3/H (amounts are fine here — this stays on the device),
 * and the daily "not logged yet" reminder after the chosen time.
 */
export async function refreshReminders(now = new Date()): Promise<void> {
  const today = todayKey(now)
  const [settings, recurring, occurrences, wallets, txs] = await Promise.all([
    getSettings(),
    db.recurring.toArray(),
    db.recurringOccurrences.toArray(),
    db.wallets.toArray(),
    db.transactions.toArray(),
  ])

  const handled = new Set(occurrences.filter((o) => o.status !== 'pending').map((o) => `${o.recurringId}:${o.date}`))
  const bills = upcomingBills({ recurring, handled, cards: wallets, txs }, today, 4)
  const keep = { bill: new Set<string>(), credit: new Set<string>() }
  for (const bill of bills) {
    const lead = bill.kind === 'credit' ? 3 : 1
    const showFrom = addDays(bill.date, -lead)
    if (showFrom > today) continue
    const kind = bill.kind === 'credit' ? 'credit' : 'bill'
    keep[kind].add(bill.key)
    const when = bill.date === today ? 'hari ini' : bill.date === addDays(today, 1) ? 'besok' : formatDayShort(bill.date)
    await upsertReminder({
      kind,
      refId: bill.key,
      title: bill.kind === 'credit' ? `Tagihan ${bill.name} jatuh tempo ${when}` : `${bill.name} jatuh tempo ${when}`,
      body: bill.kind === 'credit' ? `Tagihan belum lunas: ${formatRupiah(bill.amount)}.` : `Nominal ${formatRupiah(bill.amount)}. Pastikan saldo dompet cukup.`,
      dueAt: at(showFrom, '08:00'),
      link: bill.kind === 'credit' ? `/lainnya/dompet/${bill.refId}` : '/lainnya/rutin',
    })
  }
  await clearReminders('bill', keep.bill)
  await clearReminders('credit', keep.credit)

  // Daily: counts only transactions entered by hand today, whatever their date (FR-8.1a).
  const startOfDay = at(today, '00:00')
  const loggedToday = txs.some((t) => t.createdAt >= startOfDay && !t.recurringId)
  const due = now.getTime() >= at(today, settings.dailyReminderTime)
  if (due && !loggedToday) {
    await upsertReminder({
      kind: 'daily',
      refId: today,
      title: 'Belum mencatat hari ini',
      body: 'Sudah catat pengeluaran hari ini? Cuma butuh 10 detik.',
      dueAt: at(today, settings.dailyReminderTime),
      link: '/?add=expense',
    })
  }
  // Older daily reminders, or today's once something was logged, are no longer relevant.
  await clearReminders('daily', new Set(due && !loggedToday ? [today] : []))
}

onManualTransactionSaved(() => void refreshReminders())
