/**
 * Pure reminder decisions for the cron job (FR-8.4, FR-8.5). The server stores no
 * financial data: only an anonymous subscription, reminder time, time zone, due
 * dates with generic titles, and the last date the user logged something.
 */

export interface Due {
  /** YYYY-MM-DD in the user's time zone. */
  date: string
  kind: 'bill' | 'credit'
}

export interface ClientState {
  /** HH:mm local. */
  time: string
  timezone: string
  /** Local date the user last logged a transaction manually. */
  lastLogged?: string
  /** Local date the daily reminder was last sent. */
  lastDailySent?: string
  dues: Due[]
  /** Keys of due reminders already sent, `${date}:${offset}:${kind}`. */
  sentDues: string[]
}

export interface PushMessage {
  kind: 'daily' | 'bill' | 'credit'
  title: string
  body: string
  url: string
  tag: string
}

/** Local date and minutes-since-midnight in a time zone. */
export function localNow(now: Date, timezone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

function minusDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Due reminders are sent from 08:00 local, never at night. */
const DUE_HOUR_MINUTES = 8 * 60

const DUE_OFFSETS: Record<Due['kind'], number[]> = { bill: [1, 0], credit: [3, 0] }

/**
 * What to send now, and the updated state. Runs every ~15 minutes; anything due
 * since the last run is caught (a late cron sends late rather than never).
 */
export function decide(state: ClientState, now: Date): { messages: PushMessage[]; next: ClientState } {
  const { date: today, minutes } = localNow(now, state.timezone)
  const messages: PushMessage[] = []
  const next: ClientState = { ...state, sentDues: [...state.sentDues] }

  // (a) Daily: at/after the chosen time, only if nothing was logged manually today (FR-8.1a).
  if (minutes >= toMinutes(state.time) && state.lastDailySent !== today && state.lastLogged !== today) {
    messages.push({ kind: 'daily', title: 'Money Tracker', body: 'Sudah catat pengeluaran hari ini?', url: '/?add=expense', tag: 'daily' })
    next.lastDailySent = today
  }

  // (b)/(c) Bills H-1 & H, credit cards H-3 & H — generic titles, no amounts (FR-8.5).
  if (minutes >= DUE_HOUR_MINUTES) {
    for (const due of state.dues) {
      for (const offset of DUE_OFFSETS[due.kind]) {
        if (minusDays(due.date, offset) !== today) continue
        const key = `${due.date}:${offset}:${due.kind}`
        if (next.sentDues.includes(key)) continue
        const title = due.kind === 'bill' ? 'Tagihan rutin' : 'Kartu kredit'
        const when = offset === 0 ? 'hari ini' : offset === 1 ? 'besok' : `${offset} hari lagi`
        messages.push({ kind: due.kind, title, body: `Jatuh tempo ${when}. Buka aplikasi untuk detailnya.`, url: due.kind === 'bill' ? '/lainnya/rutin' : '/lainnya/dompet', tag: key })
        next.sentDues.push(key)
      }
    }
  }

  // Forget past dues so state doesn't grow forever.
  next.dues = state.dues.filter((d) => d.date >= today)
  next.sentDues = next.sentDues.filter((k) => k.slice(0, 10) >= minusDays(today, 1))
  return { messages, next }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const isValidTime = (t: unknown): t is string => typeof t === 'string' && TIME.test(t)
export const isValidDate = (d: unknown): d is string => typeof d === 'string' && DATE.test(d)

/** Sanitises client-sent dues: known kinds, valid dates, at most 60 entries. */
export function parseDues(input: unknown): Due[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((d): d is Due => !!d && isValidDate((d as Due).date) && ((d as Due).kind === 'bill' || (d as Due).kind === 'credit'))
    .slice(0, 60)
    .map((d) => ({ date: d.date, kind: d.kind }))
}
