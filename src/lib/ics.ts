import type { DateKey, Frequency, TimeKey } from '../db/types'

/**
 * iCalendar export (FR-8.10): a daily "catat pengeluaran" alarm plus recurring bills,
 * for people whose device can't receive push. Floating local times (no TZID) so the
 * calendar app shows them at the same clock time wherever the phone is.
 */

export interface IcsSchedule {
  uid: string
  title: string
  startDate: DateKey
  frequency: Frequency
  interval: number
  /** Weekly: ISO weekday 1–7. */
  dayOfWeek?: number
  /** Monthly/yearly: day of month (clamped by the calendar via BYMONTHDAY=-1 for 29–31). */
  dayOfMonth?: number
  monthOfYear?: number
  endDate?: DateKey
  maxCount?: number
}

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

const compactDate = (d: DateKey) => d.replaceAll('-', '')

/** RFC 5545 text escaping. */
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** RFC 5545 line folding at 75 octets (approximated by characters; our text is short). */
function fold(line: string): string {
  const parts: string[] = []
  for (let i = 0; i < line.length; i += 74) parts.push((i ? ' ' : '') + line.slice(i, i + 74))
  return parts.join('\r\n')
}

export function rrule(s: IcsSchedule): string {
  const parts = [`FREQ=${s.frequency.toUpperCase()}`]
  if (s.interval > 1) parts.push(`INTERVAL=${s.interval}`)
  if (s.frequency === 'weekly' && s.dayOfWeek) parts.push(`BYDAY=${WEEKDAYS[s.dayOfWeek - 1]}`)
  if ((s.frequency === 'monthly' || s.frequency === 'yearly') && s.dayOfMonth) {
    // Days 29–31 fall back to the month's last day (FR-7.2): pick the day or the last day, whichever comes first.
    parts.push(s.dayOfMonth >= 29 ? `BYMONTHDAY=${s.dayOfMonth},-1;BYSETPOS=1` : `BYMONTHDAY=${s.dayOfMonth}`)
  }
  if (s.frequency === 'yearly' && s.monthOfYear) parts.push(`BYMONTH=${s.monthOfYear}`)
  if (s.maxCount) parts.push(`COUNT=${s.maxCount}`)
  else if (s.endDate) parts.push(`UNTIL=${compactDate(s.endDate)}`)
  return parts.join(';')
}

export function buildIcs(input: { dailyTime?: TimeKey; startDate: DateKey; schedules: IcsSchedule[]; now?: Date }): string {
  const stamp = (input.now ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Money Tracker//ID', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Money Tracker']

  if (input.dailyTime) {
    const hhmm = input.dailyTime.replace(':', '')
    lines.push(
      'BEGIN:VEVENT',
      'UID:daily-reminder@money-tracker',
      `DTSTAMP:${stamp}`,
      `DTSTART:${compactDate(input.startDate)}T${hhmm}00`,
      'DURATION:PT5M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escapeText('Catat pengeluaran hari ini')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText('Sudah catat pengeluaran hari ini?')}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
  }

  for (const s of input.schedules) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.uid}@money-tracker`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(s.startDate)}`,
      `RRULE:${rrule(s)}`,
      `SUMMARY:${escapeText(s.title)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`${s.title} jatuh tempo besok`)}`,
      // All-day event: 1 day before at 09:00 → -PT15H from midnight of the day.
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
