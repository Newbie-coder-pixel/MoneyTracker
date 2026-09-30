import { describe, expect, it } from 'vitest'
import { buildIcs, rrule } from './ics'

describe('rrule', () => {
  it('maps frequencies', () => {
    expect(rrule({ uid: 'a', title: 'x', startDate: '2026-01-01', frequency: 'weekly', interval: 2, dayOfWeek: 5 })).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')
    expect(rrule({ uid: 'a', title: 'x', startDate: '2026-01-01', frequency: 'monthly', interval: 1, dayOfMonth: 1, maxCount: 12 })).toBe('FREQ=MONTHLY;BYMONTHDAY=1;COUNT=12')
  })

  it('clamps days 29–31 to the last day of short months', () => {
    expect(rrule({ uid: 'a', title: 'x', startDate: '2026-01-31', frequency: 'monthly', interval: 1, dayOfMonth: 31 })).toBe('FREQ=MONTHLY;BYMONTHDAY=31,-1;BYSETPOS=1')
  })
})

describe('buildIcs', () => {
  const ics = buildIcs({
    dailyTime: '21:00',
    startDate: '2026-09-30',
    schedules: [{ uid: 'kos', title: 'Kos, bulanan', startDate: '2026-10-01', frequency: 'monthly', interval: 1, dayOfMonth: 1 }],
    now: new Date('2026-09-30T00:00:00Z'),
  })

  it('is a valid calendar with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true)
  })

  it('includes the daily alarm and escaped bill titles, with no amounts', () => {
    expect(ics).toContain('DTSTART:20260930T210000')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('SUMMARY:Kos\\, bulanan')
    expect(ics).not.toMatch(/Rp/)
  })
})
