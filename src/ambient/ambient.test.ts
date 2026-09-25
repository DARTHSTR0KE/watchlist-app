import { describe, expect, it } from 'vitest'
import {
  awayLong,
  fishAsleep,
  openedTogether,
  raccoonUpLate,
  reactionFor,
  tapLevel,
  tiredFish,
} from './ambient'

// Local times, so the checks read the way the device clock does.
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min)

describe('time of day', () => {
  it('has the fish asleep before seven and awake at seven', () => {
    expect(fishAsleep(at(2026, 9, 24, 6, 59))).toBe(true)
    expect(fishAsleep(at(2026, 9, 24, 7))).toBe(false)
  })

  it('has the raccoon up after midnight, not in the evening', () => {
    expect(raccoonUpLate(at(2026, 9, 24, 0, 30))).toBe(true)
    expect(raccoonUpLate(at(2026, 9, 24, 23, 30))).toBe(false)
  })
})

describe('how long it has been', () => {
  const now = new Date('2026-09-24T12:00:00Z')

  it('is away after more than two weeks, not at a week', () => {
    expect(awayLong('2026-09-01T12:00:00Z', now)).toBe(true)
    expect(awayLong('2026-09-17T12:00:00Z', now)).toBe(false)
    expect(awayLong(null, now)).toBe(false)
    expect(awayLong(undefined, now)).toBe(false)
  })

  it('tires the fish on the fourth open of the day', () => {
    expect(tiredFish(2)).toBe(false)
    expect(tiredFish(3)).toBe(true)
    expect(tiredFish(null)).toBe(false)
  })

  it('counts two opens within ninety seconds as together', () => {
    expect(openedTogether('2026-09-24T11:58:40Z', now)).toBe(true)
    expect(openedTogether('2026-09-24T11:58:00Z', now)).toBe(false)
    expect(openedTogether(null, now)).toBe(false)
  })
})

describe('reactions to what landed', () => {
  const evening = at(2026, 9, 24, 19)
  const late = at(2026, 9, 24, 23)
  const film = { recommendedByPartner: false, rerolledAway: 0, runtimeMinutes: 110, genres: ['Drama'] }

  it('gives most films nothing', () => {
    expect(reactionFor(film, evening)).toBeNull()
    expect(reactionFor(film, late)).toBeNull()
  })

  it('flips for a film they recommended', () => {
    expect(reactionFor({ ...film, recommendedByPartner: true }, evening)).toBe('flip')
  })

  it('turns its back on a film rerolled away from four times', () => {
    expect(reactionFor({ ...film, rerolledAway: 3 }, evening)).toBeNull()
    expect(reactionFor({ ...film, rerolledAway: 4 }, evening)).toBe('back')
  })

  it('raises an eyebrow at three hours after ten, not before', () => {
    const long = { ...film, runtimeMinutes: 190 }
    expect(reactionFor(long, evening)).toBeNull()
    expect(reactionFor(long, late)).toBe('eyebrow')
  })

  it('hides from horror at night only', () => {
    const horror = { ...film, genres: ['Horror'] }
    expect(reactionFor(horror, at(2026, 9, 24, 14))).toBeNull()
    expect(reactionFor(horror, late)).toBe('hide')
  })
})

describe('taps', () => {
  it('escalates on the fourth tap in a burst', () => {
    expect(tapLevel(0)).toBe(0)
    expect(tapLevel(3)).toBe(1)
    expect(tapLevel(4)).toBe(2)
  })
})
