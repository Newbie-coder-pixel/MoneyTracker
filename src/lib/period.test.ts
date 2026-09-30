import { describe, expect, it } from 'vitest'
import { addDays, addMonthsClamped, diffDays, eachDay, isoWeekday } from './dates'
import {
  daysRemaining,
  monthPeriodByKey,
  monthPeriodLabel,
  monthPeriodOf,
  percentChange,
  shiftMonthKey,
  shiftWeek,
  weekPeriodOf,
} from './period'

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('survives DST transitions (local-noon math)', () => {
    // Europe/US DST shifts shouldn't matter; check a long span stays exact.
    expect(diffDays('2026-01-01', '2027-01-01')).toBe(365)
    expect(eachDay('2026-03-27', '2026-03-31')).toHaveLength(5)
  })

  it('clamps month arithmetic to the last day', () => {
    expect(addMonthsClamped(2026, 1, 1, 31)).toBe('2026-02-28')
    expect(addMonthsClamped(2028, 1, 1, 31)).toBe('2028-02-29')
    expect(addMonthsClamped(2026, 12, 1, 15)).toBe('2027-01-15')
    expect(addMonthsClamped(2026, 1, -1, 31)).toBe('2025-12-31')
  })

  it('uses ISO weekdays', () => {
    expect(isoWeekday('2026-09-28')).toBe(1) // Monday
    expect(isoWeekday('2026-10-04')).toBe(7) // Sunday
  })
})

describe('month periods', () => {
  it('defaults to calendar months with start day 1', () => {
    expect(monthPeriodOf('2026-02-14', 1)).toEqual({ key: '2026-02', start: '2026-02-01', end: '2026-02-28' })
  })

  it('names the period after the month it starts in (start day 25)', () => {
    // Salary on 25 Sep belongs to "September 2026" = 25 Sep – 24 Oct.
    expect(monthPeriodOf('2026-09-25', 25)).toEqual({ key: '2026-09', start: '2026-09-25', end: '2026-10-24' })
    expect(monthPeriodOf('2026-10-24', 25).key).toBe('2026-09')
    expect(monthPeriodOf('2026-09-24', 25).key).toBe('2026-08')
  })

  it('wraps the year in January', () => {
    expect(monthPeriodOf('2027-01-10', 25)).toEqual({ key: '2026-12', start: '2026-12-25', end: '2027-01-24' })
  })

  it('shifts month keys', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-11', 3)).toBe('2027-02')
  })

  it('labels non-calendar periods with their range', () => {
    expect(monthPeriodLabel(monthPeriodByKey('2026-09', 25))).toBe('September 2026 (25 Sep – 24 Okt)')
    expect(monthPeriodLabel(monthPeriodByKey('2026-09', 1))).toBe('September 2026')
  })
})

describe('week periods', () => {
  it('runs Monday to Sunday', () => {
    expect(weekPeriodOf('2026-10-01')).toEqual({ key: '2026-09-28', start: '2026-09-28', end: '2026-10-04' })
    expect(weekPeriodOf('2026-10-04').start).toBe('2026-09-28') // Sunday belongs to the week before
    expect(weekPeriodOf('2026-09-28').start).toBe('2026-09-28')
  })

  it('shifts by whole weeks', () => {
    expect(shiftWeek(weekPeriodOf('2026-10-01'), -1).start).toBe('2026-09-21')
  })
})

describe('daysRemaining', () => {
  const period = monthPeriodByKey('2026-09', 1)
  it('counts today', () => {
    expect(daysRemaining(period, '2026-09-30')).toBe(1)
    expect(daysRemaining(period, '2026-09-01')).toBe(30)
  })
  it('is 0 after the period and full before it', () => {
    expect(daysRemaining(period, '2026-10-01')).toBe(0)
    expect(daysRemaining(period, '2026-08-01')).toBe(30)
  })
})

describe('percentChange', () => {
  it('returns null ("Baru") when the previous period was 0', () => {
    expect(percentChange(100, 0)).toBeNull()
  })
  it('computes the change', () => {
    expect(percentChange(88, 100)).toBeCloseTo(-12)
    expect(percentChange(150, 100)).toBe(50)
  })
})
