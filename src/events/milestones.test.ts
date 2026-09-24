import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

const { SPIN_MILESTONES, TOGETHER_MILESTONES, countMilestones, milestoneLine, yearOfThis } =
  await import('./milestones')
const { isAround } = await import('./presence')

function occurrences(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    at: new Date(Date.UTC(2025, 0, 1) + i * 60_000).toISOString(),
    filmId: `movie:${i + 1}`,
    title: `Film ${i + 1}`,
  }))
}

describe('countMilestones', () => {
  it('reaches each threshold on the nth occurrence, remembering its film and date', () => {
    const reached = countMilestones(occurrences(100), SPIN_MILESTONES)
    expect(reached.map((m) => m.key)).toEqual(['first_spin', 'tenth_spin', 'hundredth_spin'])
    const hundredth = reached[2]
    expect(hundredth.detail).toMatchObject({ count: 100, film_id: 'movie:100', title: 'Film 100' })
    expect(hundredth.reachedAt).toBe(occurrences(100)[99].at)
  })

  it('orders by time, not by the order rows arrived in', () => {
    const shuffled = occurrences(10).reverse()
    const [first] = countMilestones(shuffled, TOGETHER_MILESTONES)
    expect(first.detail).toMatchObject({ film_id: 'movie:1' })
  })

  it('reaches nothing with nothing to count', () => {
    expect(countMilestones([], SPIN_MILESTONES)).toEqual([])
  })

  it('does not reach fifty together at forty-nine', () => {
    const keys = countMilestones(occurrences(49), TOGETHER_MILESTONES).map((m) => m.key)
    expect(keys).toEqual(['first_together', 'tenth_together'])
  })
})

describe('yearOfThis', () => {
  it('is reached a year after the earliest thing on record', () => {
    const [year] = yearOfThis(['2025-03-10T12:00:00Z', null, '2024-09-01T12:00:00Z'], new Date('2026-01-01'))
    expect(year.key).toBe('a_year_of_this')
    expect(year.detail).toMatchObject({ since: '2024-09-01', date: '2025-09-01' })
  })

  it('is not reached before the year is up', () => {
    expect(yearOfThis(['2025-12-01T00:00:00Z'], new Date('2026-06-01'))).toEqual([])
    expect(yearOfThis([null], new Date())).toEqual([])
  })
})

describe('milestoneLine', () => {
  it('says it in one line', () => {
    expect(milestoneLine('hundredth_spin', null)).toBe('that was your hundredth spin.')
    expect(milestoneLine('first_recommendation_accepted', 'Sam')).toBe(
      'that was the first recommendation of yours Sam took.',
    )
  })
})

describe('isAround', () => {
  const now = new Date('2026-09-24T12:00:00Z')
  it('counts an open in the last fifteen minutes as here', () => {
    expect(isAround('2026-09-24T11:50:00Z', now)).toBe(true)
    expect(isAround('2026-09-24T11:40:00Z', now)).toBe(false)
    expect(isAround(null, now)).toBe(false)
  })
})
