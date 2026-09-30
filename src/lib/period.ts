import type { DateKey } from '../db/types'
import { addDays, addMonthsClamped, dateFromKey, diffDays, formatDayShort, isoWeekday, makeDateKey, parseDateKey } from './dates'

export interface Period {
  /** Month periods: `YYYY-MM`; week periods: the Monday's DateKey. */
  key: string
  start: DateKey
  /** Inclusive. */
  end: DateKey
}

/**
 * Month period for a start day N (1–28). The period is named after the month it
 * starts in: with N = 25, "2026-09" = 25 Sep – 24 Oct 2026 (PRD §6.2).
 */
export function monthPeriodOf(date: DateKey, startDay: number): Period {
  const { year, month, day } = parseDateKey(date)
  const [y, m] = day >= startDay ? [year, month] : month === 1 ? [year - 1, 12] : [year, month - 1]
  return monthPeriodByKey(`${y}-${String(m).padStart(2, '0')}`, startDay)
}

export function monthPeriodByKey(key: string, startDay: number): Period {
  const [year, month] = key.split('-').map(Number)
  const start = makeDateKey(year, month, startDay)
  const nextStart = addMonthsClamped(year, month, 1, startDay)
  return { key, start, end: addDays(nextStart, -1) }
}

export function shiftMonthKey(key: string, months: number): string {
  const [year, month] = key.split('-').map(Number)
  const index = year * 12 + (month - 1) + months
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Week period, Monday to Sunday (PRD §6.2). */
export function weekPeriodOf(date: DateKey): Period {
  const start = addDays(date, 1 - isoWeekday(date))
  return { key: start, start, end: addDays(start, 6) }
}

export function shiftWeek(period: Period, weeks: number): Period {
  return weekPeriodOf(addDays(period.start, weeks * 7))
}

export function periodLength(period: Period): number {
  return diffDays(period.start, period.end) + 1
}

/** Days left in the period, counting today; 0 once the period is over. */
export function daysRemaining(period: Period, today: DateKey): number {
  if (today > period.end) return 0
  if (today < period.start) return periodLength(period)
  return diffDays(today, period.end) + 1
}

export function inPeriod(date: DateKey, period: Period): boolean {
  return date >= period.start && date <= period.end
}

const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

/** "September 2026" — the name only. */
export function monthPeriodName(period: Period): string {
  return monthName.format(dateFromKey(`${period.key}-01`))
}

/** "September 2026 (25 Sep – 24 Okt)" when the period doesn't start on the 1st (PRD §6.2). */
export function monthPeriodLabel(period: Period): string {
  const name = monthPeriodName(period)
  if (period.start.endsWith('-01')) return name
  return `${name} (${formatDayShort(period.start)} – ${formatDayShort(period.end)})`
}

/** "28 Sep – 4 Okt" */
export function weekPeriodLabel(period: Period): string {
  return `${formatDayShort(period.start)} – ${formatDayShort(period.end)}`
}

/**
 * Percentage change vs the previous period; null when the previous value is 0
 * (shown as "Baru", PRD §6.2).
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}
