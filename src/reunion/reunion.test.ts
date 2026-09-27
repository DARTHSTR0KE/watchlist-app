import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

// Just enough of a browser for the warmth to land somewhere: a root
// element to carry it and a storage the cached date is read from.
const stored = new Map<string, string>()
const root = { dataset: {} as Record<string, string | undefined> }
vi.stubGlobal('document', { documentElement: root })
vi.stubGlobal('window', {
  localStorage: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  },
})

const { applyWarmth, daysUntil, localDateString, warmFromCache, warmthFor } = await import('./reunion')

// Local times: the count is about the device's calendar, whatever hour.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

describe('daysUntil', () => {
  it('counts whole local days, whatever the hour', () => {
    expect(daysUntil('2026-10-01', at(2026, 9, 25, 0))).toBe(6)
    expect(daysUntil('2026-10-01', at(2026, 9, 25, 23))).toBe(6)
  })

  it('crosses a month end', () => {
    expect(daysUntil('2026-11-02', at(2026, 10, 30))).toBe(3)
  })

  it('is zero on the day and negative after it', () => {
    expect(daysUntil('2026-10-01', at(2026, 10, 1, 23))).toBe(0)
    expect(daysUntil('2026-10-01', at(2026, 10, 3))).toBe(-2)
  })

  it('reads the date as local, not as UTC midnight', () => {
    // Just after local midnight on the 1st it is the day, even where UTC
    // is still on the 30th.
    expect(daysUntil('2026-10-01', at(2026, 10, 1, 0))).toBe(0)
  })

  it('refuses something that is not a date', () => {
    expect(daysUntil('soon', at(2026, 9, 25))).toBeNull()
  })
})

describe('localDateString', () => {
  it('is built from local parts', () => {
    expect(localDateString(at(2026, 1, 5, 0))).toBe('2026-01-05')
  })
})

describe('warmthFor', () => {
  it('is normal more than a week out, when past, or with no date', () => {
    expect(warmthFor(8)).toBe('none')
    expect(warmthFor(-1)).toBe('none')
    expect(warmthFor(null)).toBe('none')
  })

  it('warms through the five stages', () => {
    expect(warmthFor(7)).toBe('week')
    expect(warmthFor(3)).toBe('week')
    expect(warmthFor(2)).toBe('two')
    expect(warmthFor(1)).toBe('eve')
    expect(warmthFor(0)).toBe('day')
  })
})

describe('the five stages, day by day', () => {
  const expected: Record<number, string> = {
    [-30]: 'none', [-2]: 'none', [-1]: 'none',
    0: 'day', 1: 'eve', 2: 'two',
    3: 'week', 4: 'week', 5: 'week', 6: 'week', 7: 'week',
    8: 'none', 9: 'none', 30: 'none',
  }

  it.each(Object.entries(expected))('%s days out is %s', (days, warmth) => {
    expect(warmthFor(Number(days))).toBe(warmth)
  })

  it('reaches every stage from a real date, counting local days', () => {
    // The 1st of October, seen at a minute past midnight local time, when
    // UTC is still on the previous day: each stage must still land on its
    // own local day.
    const stages = [8, 7, 3, 2, 1, 0, -1].map((before) =>
      warmthFor(daysUntil('2026-10-01', new Date(2026, 9, 1 - before, 0, 1))),
    )
    expect(stages).toEqual(['none', 'week', 'week', 'two', 'eve', 'day', 'none'])
  })

  it('turns over at local midnight, not UTC midnight', () => {
    expect(warmthFor(daysUntil('2026-10-01', new Date(2026, 8, 30, 23, 59)))).toBe('eve')
    expect(warmthFor(daysUntil('2026-10-01', new Date(2026, 9, 1, 0, 0)))).toBe('day')
  })

  it('builds the date string from local parts late in the evening too', () => {
    // 23:30 in Kolkata on the 31st is still the 31st, though UTC says 18:00.
    expect(localDateString(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
    expect(localDateString(new Date(2027, 0, 1, 0, 15))).toBe('2027-01-01')
  })
})

describe('the resting state', () => {
  it('rests with no date set', () => {
    stored.clear()
    warmFromCache()
    expect(applyWarmth(new Date(2026, 8, 30))).toBe('none')
    expect(root.dataset.warmth).toBeUndefined()
  })

  it('warms with a date a few days out, and rests again once it has passed', () => {
    stored.set('reunion-date', '2026-10-01')
    warmFromCache()
    expect(applyWarmth(new Date(2026, 8, 29, 9))).toBe('two')
    expect(root.dataset.warmth).toBe('two')
    expect(applyWarmth(new Date(2026, 9, 2, 9))).toBe('none')
    expect(root.dataset.warmth).toBeUndefined()
  })
})
