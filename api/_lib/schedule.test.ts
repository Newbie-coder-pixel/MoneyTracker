import { describe, expect, it } from 'vitest'
import { decide, isValidTimezone, localNow, parseDues, type ClientState } from './schedule'

// 2026-09-30 14:05 UTC = 21:05 in Jakarta (UTC+7).
const at = (iso: string) => new Date(iso)
const base: ClientState = { time: '21:00', timezone: 'Asia/Jakarta', dues: [], sentDues: [] }

describe('localNow', () => {
  it('converts to the user time zone', () => {
    expect(localNow(at('2026-09-30T14:05:00Z'), 'Asia/Jakarta')).toEqual({ date: '2026-09-30', minutes: 21 * 60 + 5 })
    expect(localNow(at('2026-09-30T18:30:00Z'), 'Asia/Jakarta').date).toBe('2026-10-01')
  })
})

describe('daily reminder (acceptance)', () => {
  it('fires once after the chosen time when nothing was logged today', () => {
    const first = decide(base, at('2026-09-30T14:05:00Z'))
    expect(first.messages.map((m) => m.kind)).toEqual(['daily'])
    expect(first.messages[0]).toMatchObject({ body: 'Sudah catat pengeluaran hari ini?', url: '/?add=expense' })
    expect(decide(first.next, at('2026-09-30T14:20:00Z')).messages).toEqual([])
  })

  it('does not fire before the time', () => {
    expect(decide(base, at('2026-09-30T13:50:00Z')).messages).toEqual([])
  })

  it('does not fire when the user already logged today', () => {
    expect(decide({ ...base, lastLogged: '2026-09-30' }, at('2026-09-30T14:05:00Z')).messages).toEqual([])
  })

  it('fires again the next day', () => {
    const { next } = decide(base, at('2026-09-30T14:05:00Z'))
    expect(decide(next, at('2026-10-01T14:05:00Z')).messages).toHaveLength(1)
  })
})

describe('due reminders', () => {
  const state: ClientState = { ...base, time: '23:59', dues: [{ date: '2026-10-01', kind: 'bill' }, { date: '2026-10-03', kind: 'credit' }] }

  it('sends bill H-1 and credit H-3 from 08:00, without amounts, once', () => {
    const early = decide(state, at('2026-09-30T00:30:00Z')) // 07:30 local
    expect(early.messages).toEqual([])
    const r = decide(state, at('2026-09-30T02:00:00Z')) // 09:00 local
    expect(r.messages.map((m) => [m.title, m.body])).toEqual([
      ['Tagihan rutin', 'Jatuh tempo besok. Buka aplikasi untuk detailnya.'],
      ['Kartu kredit', 'Jatuh tempo 3 hari lagi. Buka aplikasi untuk detailnya.'],
    ])
    expect(r.messages.some((m) => /\d{3}/.test(m.body))).toBe(false)
    expect(decide(r.next, at('2026-09-30T05:00:00Z')).messages).toEqual([])
  })

  it('sends on the due day and then forgets the due', () => {
    const r = decide({ ...state, dues: [{ date: '2026-10-01', kind: 'bill' }] }, at('2026-10-01T02:00:00Z'))
    expect(r.messages.map((m) => m.body)).toEqual(['Jatuh tempo hari ini. Buka aplikasi untuk detailnya.'])
    expect(decide(r.next, at('2026-10-02T02:00:00Z')).next.dues).toEqual([])
  })
})

describe('input validation', () => {
  it('rejects bad time zones and dues', () => {
    expect(isValidTimezone('Asia/Jakarta')).toBe(true)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
    expect(parseDues([{ date: '2026-10-01', kind: 'bill', amount: 5 }, { date: 'x', kind: 'bill' }, { date: '2026-10-01', kind: 'hack' }])).toEqual([
      { date: '2026-10-01', kind: 'bill' },
    ])
  })
})
