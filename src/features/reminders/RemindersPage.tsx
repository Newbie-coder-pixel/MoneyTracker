import { useLiveQuery } from 'dexie-react-hooks'
import { BellOff, BellRing, CalendarPlus, CheckCheck, ChevronRight, Send, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AppHeader } from '../../components/AppHeader'
import { downloadFile } from '../../components/download'
import { inputClass } from '../../components/Pickers'
import { showToast } from '../../components/toast'
import { setReminderStatus } from '../../db/reminders'
import { db } from '../../db/schema'
import { setSetting, useSettings } from '../../db/settings'
import type { Reminder } from '../../db/types'
import { buildIcs } from '../../lib/ics'
import { todayKey } from '../../lib/dates'
import { isIOS, isStandalone } from '../../pwa/install-prompt'
import { notificationStatus } from '../../pwa/notifications'
import { disablePush, enablePush, pushUpdate, sendTestPush, type EnableResult } from '../../pwa/push'
import { refreshReminders } from './refresh'

const KIND_LABEL: Record<Reminder['kind'], { label: string; className: string }> = {
  daily: { label: 'Pengingat harian', className: 'bg-income-soft text-income' },
  bill: { label: 'Tagihan rutin', className: 'bg-primary-soft text-primary' },
  credit: { label: 'Kartu kredit', className: 'bg-expense-soft text-expense' },
  budget: { label: 'Budget', className: 'bg-warning-soft text-warning' },
  backup: { label: 'Backup', className: 'bg-surface-muted text-text-muted' },
}

const FAILURE: Record<Exclude<EnableResult, { ok: true }>['reason'], string> = {
  unsupported: 'Browser ini tidak mendukung notifikasi. Pakai pengingat kalender (.ics) di bawah.',
  'ios-install': 'Di iPhone, pasang aplikasi ke Layar Utama dulu (Bagikan → Tambahkan ke Layar Utama), lalu aktifkan dari sana.',
  denied: 'Izin notifikasi ditolak. Buka pengaturan situs di browser untuk mengizinkannya.',
  'no-sw': 'Aplikasi belum siap offline. Muat ulang halaman lalu coba lagi.',
  server: 'Server pengingat belum bisa dihubungi. Coba lagi nanti.',
}

function relative(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} mnt lalu`
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} jam lalu`
  return `${Math.round(minutes / (24 * 60))} hari lalu`
}

export function RemindersPage() {
  const settings = useSettings()
  const reminders = useLiveQuery(async () =>
    (await db.reminders.where('status').equals('active').toArray()).filter((r) => r.dueAt <= Date.now()).sort((a, b) => b.dueAt - a.dueAt),
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const status = notificationStatus()
  const pushOn = !!settings?.pushEnabled && status === 'granted'

  const togglePush = async () => {
    setBusy(true)
    setMessage(null)
    try {
      if (pushOn) {
        await disablePush()
        showToast('Notifikasi dimatikan')
      } else {
        const result = await enablePush()
        if (result.ok) showToast('Notifikasi aktif')
        else setMessage(FAILURE[result.reason])
      }
    } finally {
      setBusy(false)
    }
  }

  const changeTime = async (time: string) => {
    if (!time) return
    await setSetting('dailyReminderTime', time)
    await refreshReminders()
    await pushUpdate().catch(() => undefined)
    showToast(`Pengingat harian jam ${time}`)
  }

  const exportIcs = async () => {
    const schedules = (await db.recurring.toArray()).filter((r) => !r.paused && r.template.type === 'expense')
    const ics = buildIcs({
      dailyTime: settings?.dailyReminderTime,
      startDate: todayKey(),
      schedules: schedules.map((r) => ({
        uid: r.id,
        title: r.name,
        startDate: r.startDate,
        frequency: r.frequency,
        interval: r.interval,
        dayOfWeek: r.dayOfWeek,
        dayOfMonth: r.dayOfMonth,
        monthOfYear: r.monthOfYear,
        endDate: r.endDate,
        maxCount: r.maxCount,
      })),
    })
    downloadFile('money-tracker-pengingat.ics', ics, 'text/calendar')
  }

  const statusChip =
    status === 'unsupported'
      ? { text: 'Tidak didukung', className: 'bg-surface-muted text-text-muted' }
      : status === 'denied'
        ? { text: 'Diblokir', className: 'bg-expense-soft text-expense' }
        : pushOn
          ? { text: 'Aktif', className: 'bg-income-soft text-income' }
          : { text: 'Belum aktif', className: 'bg-surface-muted text-text-muted' }

  return (
    <>
      <AppHeader title="Pengingat" back />
      <main className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusChip.className}`}>Notifikasi: {statusChip.text}</span>
          {!!reminders?.length && (
            <button
              type="button"
              onClick={() => void Promise.all(reminders.map((r) => setReminderStatus(r.id, 'done')))}
              className="flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary"
            >
              <CheckCheck className="size-4" aria-hidden="true" /> Tandai dibaca
            </button>
          )}
        </div>

        {reminders?.length ? (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li key={r.id} className="rounded-3xl bg-surface p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${KIND_LABEL[r.kind].className}`}>{KIND_LABEL[r.kind].label}</span>
                      <span className="text-text-muted">{relative(r.dueAt)}</span>
                    </p>
                    <p className="mt-1 font-semibold">{r.title}</p>
                    <p className="text-sm text-text-muted">{r.body}</p>
                  </div>
                  <button type="button" onClick={() => void setReminderStatus(r.id, 'dismissed')} aria-label="Tutup pengingat" className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full">
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </div>
                {r.link && (
                  <Link
                    to={r.link}
                    onClick={() => void setReminderStatus(r.id, 'done')}
                    className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-muted px-4 text-sm font-semibold"
                  >
                    {r.kind === 'daily' ? 'Catat sekarang' : 'Buka'} <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-3xl bg-surface px-4 py-8 text-center text-sm text-text-muted">Tidak ada pengingat saat ini.</p>
        )}

        <section className="space-y-4 rounded-3xl bg-surface p-4">
          <h2 className="text-lg font-semibold">Pengaturan notifikasi</h2>

          <label className="flex min-h-14 items-center gap-3">
            {pushOn ? <BellRing className="size-5 text-primary" aria-hidden="true" /> : <BellOff className="size-5 text-text-muted" aria-hidden="true" />}
            <span className="flex-1">
              <span className="block font-medium">Notifikasi di perangkat</span>
              <span className="block text-xs text-text-muted">Pengingat harian dan jatuh tempo, walau aplikasi tertutup.</span>
            </span>
            <input type="checkbox" checked={pushOn} disabled={busy || status === 'unsupported'} onChange={() => void togglePush()} className="size-5 accent-primary" />
          </label>

          {isIOS() && !isStandalone() && (
            <p className="rounded-2xl bg-warning-soft px-4 py-3 text-sm">
              iPhone hanya mengirim notifikasi dari aplikasi yang sudah dipasang: di Safari ketuk <b>Bagikan</b> → <b>Tambahkan ke Layar Utama</b>, lalu buka dari ikon
              barunya (iOS 16.4+).
            </p>
          )}
          {status === 'denied' && (
            <p className="rounded-2xl bg-expense-soft px-4 py-3 text-sm">
              Notifikasi diblokir. Buka pengaturan browser → Setelan situs → Notifikasi, izinkan untuk situs ini, lalu muat ulang aplikasi.
            </p>
          )}
          {message && (
            <p role="alert" className="rounded-2xl bg-warning-soft px-4 py-3 text-sm">
              {message}
            </p>
          )}

          <label className="block text-sm">
            <span className="font-medium">Jam pengingat harian</span>
            <span className="block text-xs text-text-muted">Dikirim hanya jika hari itu belum ada transaksi yang kamu catat sendiri.</span>
            {settings && (
              <input type="time" defaultValue={settings.dailyReminderTime} onBlur={(e) => void changeTime(e.target.value)} className={inputClass} />
            )}
          </label>

          {pushOn && (
            <button
              type="button"
              onClick={async () => showToast((await sendTestPush()) ? 'Notifikasi uji dikirim' : 'Gagal mengirim notifikasi uji', { tone: 'default' })}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface-muted font-semibold"
            >
              <Send className="size-5" aria-hidden="true" /> Kirim notifikasi uji
            </button>
          )}

          <div className="border-t border-border/60 pt-4">
            <p className="text-sm font-medium">Cadangan: pengingat di kalender</p>
            <p className="text-xs text-text-muted">Unduh file .ics berisi alarm harian dan jadwal tagihan, lalu buka di Google Calendar atau Kalender iPhone. Tanpa nominal.</p>
            <button type="button" onClick={() => void exportIcs()} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft font-semibold text-primary">
              <CalendarPlus className="size-5" aria-hidden="true" /> Tambahkan ke Kalender
            </button>
          </div>
        </section>
      </main>
    </>
  )
}
