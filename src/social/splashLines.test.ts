import { describe, expect, it, vi } from 'vitest'

// The module reads the client at import; nothing here touches it.
vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

const { canChangeLine, monthKey, nextChangeLabel } = await import('./splashLines')

describe('the once-a-month rule, as the screen describes it', () => {
  it('counts months in India time, not UTC', () => {
    // 20:00 UTC on 31 October is 01:30 on 1 November in Kolkata.
    expect(monthKey(new Date('2026-10-31T20:00:00Z'))).toBe('2026-11')
    expect(monthKey(new Date('2026-10-31T18:00:00Z'))).toBe('2026-10')
  })

  it('locks for the rest of the month it was set in', () => {
    const setAt = '2026-10-03T10:00:00Z'
    expect(canChangeLine(setAt, new Date('2026-10-31T12:00:00Z'))).toBe(false)
    expect(canChangeLine(setAt, new Date('2026-11-01T00:00:00+05:30'))).toBe(true)
  })

  it('names the first of next month', () => {
    const now = new Date('2026-10-20T10:00:00Z')
    expect(nextChangeLabel('2026-10-03T10:00:00Z', now)).toBe('1 November')
  })

  it('names the year when next month is in the next one', () => {
    const now = new Date('2026-12-20T10:00:00Z')
    expect(nextChangeLabel('2026-12-03T10:00:00Z', now)).toBe('1 January 2027')
  })
})
