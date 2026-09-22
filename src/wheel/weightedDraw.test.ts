import { describe, expect, it } from 'vitest'
import { WHEEL_DRAW_SIZE, ageWeight, weightedSample } from './weightedDraw'
import { film, seededRandom } from '../test/factories'

const NOW = new Date('2026-09-22T12:00:00+05:30').getTime()
const MONTH = 1000 * 60 * 60 * 24 * 30.44

// A title added this many months ago.
const aged = (id: string, months: number) =>
  film({ id, addedAt: new Date(NOW - months * MONTH).toISOString() })

describe('how long a title has been waiting', () => {
  it('counts for nothing on the day it is added, but never zero', () => {
    expect(ageWeight(aged('today', 0), NOW)).toBe(1)
  })

  it('goes up by one for every month waited', () => {
    expect(ageWeight(aged('a', 1), NOW)).toBe(2)
    expect(ageWeight(aged('b', 6), NOW)).toBe(7)
    expect(ageWeight(aged('c', 24), NOW)).toBe(25)
  })

  it('treats a title with no date, or an unreadable one, as new rather than impossible', () => {
    expect(ageWeight(film({ id: 'none', addedAt: null }), NOW)).toBe(1)
    expect(ageWeight(film({ id: 'junk', addedAt: 'not a date' }), NOW)).toBe(1)
  })

  it('does not go negative for a date in the future', () => {
    expect(ageWeight(film({ id: 'future', addedAt: new Date(NOW + 5 * MONTH).toISOString() }), NOW)).toBe(1)
  })
})

describe('the draw', () => {
  it('brings older titles up more often, over many draws', () => {
    // One title a year old against nine added today: its weight is 13 to
    // their 1, so it should come up far more often than an even split.
    const pool = [aged('old', 12), ...Array.from({ length: 9 }, (_, i) => aged(`new-${i}`, 0))]
    const random = seededRandom(1234)

    const runs = 4000
    let oldDrawn = 0
    for (let n = 0; n < runs; n++) {
      if (weightedSample(pool, 3, random, NOW).some((item) => item.id === 'old')) oldDrawn += 1
    }

    // An even draw of 3 from 10 would show it about 30% of the time.
    // Weighted, it should be well above that — the tolerance is wide
    // because this is a distribution, not an identity.
    const rate = oldDrawn / runs
    expect(rate, `drawn ${(rate * 100).toFixed(1)}% of the time`).toBeGreaterThan(0.6)
    expect(rate).toBeLessThanOrEqual(1)
  })

  it('orders a pool by age on average: older titles appear more than younger ones', () => {
    const pool = [aged('oldest', 36), aged('middle', 12), aged('newest', 0)]
    const random = seededRandom(777)
    const counts = new Map<string, number>([
      ['oldest', 0],
      ['middle', 0],
      ['newest', 0],
    ])
    for (let n = 0; n < 6000; n++) {
      for (const item of weightedSample(pool, 1, random, NOW)) {
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
      }
    }
    expect(counts.get('oldest')!).toBeGreaterThan(counts.get('middle')!)
    expect(counts.get('middle')!).toBeGreaterThan(counts.get('newest')!)
  })

  it('never repeats a title within one draw', () => {
    const pool = Array.from({ length: 20 }, (_, i) => aged(`f-${i}`, i))
    const random = seededRandom(42)
    for (let n = 0; n < 500; n++) {
      const drawn = weightedSample(pool, WHEEL_DRAW_SIZE, random, NOW)
      expect(new Set(drawn.map((item) => item.id)).size).toBe(drawn.length)
    }
  })

  it('gives everything it has when asked for more than it holds', () => {
    const pool = [aged('a', 1), aged('b', 2)]
    expect(weightedSample(pool, WHEEL_DRAW_SIZE, seededRandom(8), NOW)).toHaveLength(2)
  })

  it('draws nothing from nothing rather than failing', () => {
    expect(weightedSample([], WHEEL_DRAW_SIZE, seededRandom(8), NOW)).toEqual([])
  })

  it('still fills the wheel when every weight is the same', () => {
    const pool = Array.from({ length: 12 }, (_, i) => film({ id: `f-${i}`, addedAt: null }))
    const drawn = weightedSample(pool, WHEEL_DRAW_SIZE, seededRandom(6), NOW)
    expect(drawn).toHaveLength(WHEEL_DRAW_SIZE)
    expect(new Set(drawn.map((item) => item.id)).size).toBe(WHEEL_DRAW_SIZE)
  })
})
