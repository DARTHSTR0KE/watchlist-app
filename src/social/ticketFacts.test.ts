import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

const { comparedToLastYear, forMeCounts, togetherByYear, yearOf } = await import('./ticketFacts')

describe('yearOf', () => {
  it('reads the year off a date or a timestamp', () => {
    expect(yearOf('2026-03-04')).toBe(2026)
    expect(yearOf('2025-12-31T23:00:00+00:00')).toBe(2025)
    expect(yearOf(null)).toBeNull()
  })
})

describe('For me', () => {
  it('counts what they sent this year, and how many of those I have watched', () => {
    const received = [
      { filmId: 'a', createdAt: '2026-02-01T10:00:00Z', status: 'watched' as const },
      { filmId: 'b', createdAt: '2026-05-01T10:00:00Z', status: 'queued' as const },
      { filmId: 'c', createdAt: '2026-06-01T10:00:00Z', status: 'queued' as const },
      { filmId: 'd', createdAt: '2025-06-01T10:00:00Z', status: 'watched' as const },
    ]
    // 'b' is watched by my own record, though its status never moved.
    expect(forMeCounts(received, new Set(['b']), 2026)).toEqual({ sentThisYear: 3, watchedOfThem: 2 })
  })
})

describe('Together', () => {
  it('counts each film once, at its latest sitting, by year', () => {
    const counts = togetherByYear([
      { filmId: 'a', watchedOn: '2025-11-01' },
      { filmId: 'a', watchedOn: '2026-01-10' },
      { filmId: 'b', watchedOn: '2026-02-02' },
      { filmId: 'c', watchedOn: '2025-03-03' },
      { filmId: 'd', watchedOn: null },
    ])
    expect(counts.get(2026)).toBe(2)
    expect(counts.get(2025)).toBe(1)
  })

  it('compares this year with last in a few words', () => {
    expect(comparedToLastYear(14, 9)).toBe('5 MORE THAN LAST YEAR')
    expect(comparedToLastYear(3, 9)).toBe('6 FEWER THAN LAST YEAR')
    expect(comparedToLastYear(4, 4)).toBe('THE SAME AS LAST YEAR')
    expect(comparedToLastYear(4, 0)).toBe('NONE LAST YEAR')
    expect(comparedToLastYear(0, 0)).toBe('NOTHING SIDE BY SIDE YET')
  })
})
