import { describe, expect, it } from 'vitest'
import { describeSchedule, dueDates, nextOccurrence, occurrencesBetween, type Schedule } from './recurring'

const monthly = (over: Partial<Schedule> = {}): Schedule => ({
  frequency: 'monthly',
  interval: 1,
  dayOfMonth: 31,
  startDate: '2026-08-31',
  ...over,
})

describe('monthly on the 31st (acceptance)', () => {
  it('falls on 30 Sep and 28/29 Feb', () => {
    expect(occurrencesBetween(monthly(), '2026-09-01', '2026-10-31')).toEqual(['2026-09-30', '2026-10-31'])
    expect(occurrencesBetween(monthly(), '2027-02-01', '2027-02-28')).toEqual(['2027-02-28'])
    expect(occurrencesBetween(monthly({ startDate: '2027-12-31' }), '2028-02-01', '2028-02-29')).toEqual(['2028-02-29'])
  })

  it('starts next month when startDate is after the day', () => {
    expect(occurrencesBetween(monthly({ dayOfMonth: 1, startDate: '2026-09-15' }), '2026-09-01', '2026-11-30')).toEqual([
      '2026-10-01',
      '2026-11-01',
    ])
  })
})

describe('dueDates catch-up (acceptance: 3 months unopened)', () => {
  const kos = monthly({ dayOfMonth: 1, startDate: '2026-07-01' })

  it('returns each missed occurrence once', () => {
    expect(dueDates({ ...kos, lastProcessedDate: '2026-07-01' }, '2026-10-05')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
  })

  it('returns nothing when already processed today', () => {
    expect(dueDates({ ...kos, lastProcessedDate: '2026-10-05' }, '2026-10-05')).toEqual([])
  })

  it('includes the start date on first run', () => {
    expect(dueDates({ ...kos, lastProcessedDate: undefined }, '2026-07-01')).toEqual(['2026-07-01'])
  })
})

describe('other frequencies', () => {
  it('daily with interval', () => {
    const s: Schedule = { frequency: 'daily', interval: 2, startDate: '2026-09-01' }
    expect(occurrencesBetween(s, '2026-09-01', '2026-09-07')).toEqual(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07'])
  })

  it('weekly on a chosen weekday', () => {
    const s: Schedule = { frequency: 'weekly', interval: 1, dayOfWeek: 5, startDate: '2026-09-28' } // Fridays
    expect(occurrencesBetween(s, '2026-09-28', '2026-10-12')).toEqual(['2026-10-02', '2026-10-09'])
  })

  it('yearly, clamping 29 Feb', () => {
    const s: Schedule = { frequency: 'yearly', interval: 1, monthOfYear: 2, dayOfMonth: 29, startDate: '2028-01-01' }
    expect(occurrencesBetween(s, '2028-01-01', '2030-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28'])
  })

  it('stops at endDate and maxCount', () => {
    const s = monthly({ dayOfMonth: 15, startDate: '2026-01-01', maxCount: 3 })
    expect(occurrencesBetween(s, '2026-01-01', '2026-12-31')).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
    // maxCount counts from the first occurrence even when the window starts later.
    expect(occurrencesBetween(s, '2026-03-01', '2026-12-31')).toEqual(['2026-03-15'])
    const e = monthly({ dayOfMonth: 15, startDate: '2026-01-01', endDate: '2026-02-20' })
    expect(occurrencesBetween(e, '2026-01-01', '2026-12-31')).toEqual(['2026-01-15', '2026-02-15'])
  })
})

describe('nextOccurrence', () => {
  it('finds the next date on or after today', () => {
    expect(nextOccurrence(monthly({ dayOfMonth: 1, startDate: '2026-01-01' }), '2026-09-29')).toBe('2026-10-01')
    expect(nextOccurrence(monthly({ dayOfMonth: 1, startDate: '2026-01-01', maxCount: 2 }), '2026-09-29')).toBeNull()
  })
})

describe('describeSchedule', () => {
  it('reads naturally', () => {
    expect(describeSchedule(monthly({ dayOfMonth: 1 }))).toBe('Bulanan • Setiap tgl 1')
    expect(describeSchedule({ frequency: 'weekly', interval: 1, dayOfWeek: 1, startDate: '2026-01-01' })).toBe('Mingguan • Senin')
  })
})
