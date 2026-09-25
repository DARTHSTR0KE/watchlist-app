import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

const { daysUntil, localDateString, warmthFor } = await import('./reunion')

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
