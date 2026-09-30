import type { DateKey, Recurring } from '../db/types'
import { addDays, addMonthsClamped, isoWeekday, parseDateKey } from './dates'

export type Schedule = Pick<
  Recurring,
  'frequency' | 'interval' | 'dayOfWeek' | 'dayOfMonth' | 'monthOfYear' | 'startDate' | 'endDate' | 'maxCount'
>

/** Guard against runaway loops on corrupted data (daily for ~270 years). */
const MAX_ITERATIONS = 100_000

/** The first occurrence on/after startDate. */
function firstOccurrence(s: Schedule): DateKey {
  const start = parseDateKey(s.startDate)
  switch (s.frequency) {
    case 'daily':
      return s.startDate
    case 'weekly': {
      const target = s.dayOfWeek ?? isoWeekday(s.startDate)
      return addDays(s.startDate, (target - isoWeekday(s.startDate) + 7) % 7)
    }
    case 'monthly': {
      const day = s.dayOfMonth ?? start.day
      const candidate = addMonthsClamped(start.year, start.month, 0, day)
      return candidate >= s.startDate ? candidate : addMonthsClamped(start.year, start.month, 1, day)
    }
    case 'yearly': {
      const month = s.monthOfYear ?? start.month
      const day = s.dayOfMonth ?? start.day
      const candidate = addMonthsClamped(start.year, month, 0, day)
      return candidate >= s.startDate ? candidate : addMonthsClamped(start.year + 1, month, 0, day)
    }
  }
}

/** The n-th occurrence (0-based). Monthly/yearly clamp each time, so the 31st → 30 Sep → 31 Oct. */
function nthOccurrence(s: Schedule, first: DateKey, n: number): DateKey {
  const interval = Math.max(1, s.interval || 1)
  switch (s.frequency) {
    case 'daily':
      return addDays(first, n * interval)
    case 'weekly':
      return addDays(first, n * 7 * interval)
    case 'monthly': {
      const f = parseDateKey(first)
      return addMonthsClamped(f.year, f.month, n * interval, s.dayOfMonth ?? parseDateKey(s.startDate).day)
    }
    case 'yearly': {
      const f = parseDateKey(first)
      return addMonthsClamped(f.year, f.month, n * 12 * interval, s.dayOfMonth ?? parseDateKey(s.startDate).day)
    }
  }
}

/**
 * All occurrence dates in [from, to] (inclusive), honouring startDate, endDate,
 * interval and maxCount (counted from the very first occurrence).
 */
export function occurrencesBetween(s: Schedule, from: DateKey, to: DateKey): DateKey[] {
  const first = firstOccurrence(s)
  const result: DateKey[] = []
  for (let n = 0; n < MAX_ITERATIONS; n++) {
    if (s.maxCount && n >= s.maxCount) break
    const date = nthOccurrence(s, first, n)
    if (date > to || (s.endDate && date > s.endDate)) break
    if (date >= from) result.push(date)
  }
  return result
}

/** Dates the catch-up must handle: since the last processed date (exclusive) up to today (FR-7.4). */
export function dueDates(r: Schedule & Pick<Recurring, 'lastProcessedDate'>, today: DateKey): DateKey[] {
  const from = r.lastProcessedDate ? addDays(r.lastProcessedDate, 1) : r.startDate
  if (from > today) return []
  return occurrencesBetween(r, from, today)
}

/** Next occurrence on/after `from`, or null when the schedule has ended. */
export function nextOccurrence(s: Schedule, from: DateKey): DateKey | null {
  // Look ahead just over one full cycle of the longest frequency.
  const horizon = addDays(from, 366 * Math.max(1, s.interval || 1) + 1)
  return occurrencesBetween(s, from, horizon)[0] ?? null
}

/** Rough monthly cost of a schedule, for the "total rutin bulanan" summary. */
export function monthlyEquivalent(s: Pick<Schedule, 'frequency' | 'interval'>, amount: number): number {
  const interval = Math.max(1, s.interval || 1)
  const perMonth = { daily: 365 / 12, weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }[s.frequency]
  return Math.round((amount * perMonth) / interval)
}

/** "Bulanan • Setiap tgl 1" */
export function describeSchedule(s: Schedule): string {
  const every = s.interval > 1 ? `Setiap ${s.interval} ` : ''
  const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  switch (s.frequency) {
    case 'daily':
      return every ? `${every}hari` : 'Harian'
    case 'weekly':
      return `${every ? `${every}minggu` : 'Mingguan'} • ${weekdays[(s.dayOfWeek ?? 1) - 1]}`
    case 'monthly':
      return `${every ? `${every}bulan` : 'Bulanan'} • Setiap tgl ${s.dayOfMonth ?? parseDateKey(s.startDate).day}`
    case 'yearly':
      return `${every ? `${every}tahun` : 'Tahunan'} • ${s.dayOfMonth ?? parseDateKey(s.startDate).day} ${
        months[(s.monthOfYear ?? parseDateKey(s.startDate).month) - 1]
      }`
  }
}
