import type { DateKey, TimeKey } from '../db/types'

// All date math works on local calendar dates (`YYYY-MM-DD`) so that time zones and
// DST can never shift a transaction to another day. Date objects are created at local
// noon, which is safe from DST edges.

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toTimeKey(date: Date): TimeKey {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function makeDateKey(year: number, month1: number, day: number): DateKey {
  return `${year}-${pad(month1)}-${pad(day)}`
}

export function parseDateKey(key: DateKey): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

export function dateFromKey(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key)
  return new Date(year, month - 1, day, 12)
}

export function todayKey(now = new Date()): DateKey {
  return toDateKey(now)
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = dateFromKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

/** Same day-of-month N months later, clamped to the last day (Jan 31 + 1 → Feb 28/29). */
export function addMonthsClamped(year: number, month1: number, months: number, day: number): DateKey {
  const index = year * 12 + (month1 - 1) + months
  const y = Math.floor(index / 12)
  const m = (index % 12) + 1
  return makeDateKey(y, m, Math.min(day, daysInMonth(y, m)))
}

/** Whole days from a to b (b − a). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((dateFromKey(b).getTime() - dateFromKey(a).getTime()) / 86_400_000)
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(key: DateKey): number {
  const day = dateFromKey(key).getDay()
  return day === 0 ? 7 : day
}

export function minKey(a: DateKey, b: DateKey): DateKey {
  return a < b ? a : b
}

export function maxKey(a: DateKey, b: DateKey): DateKey {
  return a > b ? a : b
}

/** Inclusive list of every date from start to end. */
export function eachDay(start: DateKey, end: DateKey): DateKey[] {
  const days: DateKey[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

const dayFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
const shortFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
const shortYearFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const weekdayShortFormatter = new Intl.DateTimeFormat('id-ID', { weekday: 'short' })
const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const monthShortFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short' })

/** "Senin, 29 Sep 2026" */
export const formatDayLong = (key: DateKey) => dayFormatter.format(dateFromKey(key))
/** "29 Sep" */
export const formatDayShort = (key: DateKey) => shortFormatter.format(dateFromKey(key))
/** "29 Sep 2026" */
export const formatDayShortYear = (key: DateKey) => shortYearFormatter.format(dateFromKey(key))
/** "Sen" */
export const formatWeekdayShort = (key: DateKey) => weekdayShortFormatter.format(dateFromKey(key))
/** "September 2026" */
export const formatMonthYear = (key: DateKey) => monthFormatter.format(dateFromKey(key))
/** "Sep" */
export const formatMonthShort = (key: DateKey) => monthShortFormatter.format(dateFromKey(key))

/** "Hari ini", "Kemarin", or the long date. */
export function formatRelativeDay(key: DateKey, today = todayKey()): string {
  if (key === today) return 'Hari ini'
  if (key === addDays(today, -1)) return 'Kemarin'
  return formatDayLong(key)
}
