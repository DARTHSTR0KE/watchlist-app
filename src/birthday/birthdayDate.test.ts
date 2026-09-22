import { describe, expect, it } from 'vitest'
import { isBirthday, localDateKey } from './birthdayDate'

/**
 * The bug these guard against is reading the calendar in UTC. In Kolkata
 * that is five and a half hours out, so the 30th begins while UTC still
 * says the 29th and ends while UTC already says the 1st — which is the
 * only condition under which a UTC mistake is visible at all.
 */
describe('30 September', () => {
  it('is running well off UTC, or none of the rest proves anything', () => {
    // The offset, not the name: Node resolves Asia/Kolkata to its older
    // alias Asia/Calcutta, and a test that asserted the spelling would be
    // checking a label rather than the five and a half hours that matter.
    expect(new Date('2026-09-30T12:00:00Z').getTimezoneOffset()).toBe(-330)
  })

  it('is true at the start, middle and end of the local day', () => {
    expect(isBirthday(new Date(2026, 8, 30, 0, 0, 0))).toBe(true)
    expect(isBirthday(new Date(2026, 8, 30, 0, 30, 0))).toBe(true)
    expect(isBirthday(new Date(2026, 8, 30, 23, 59, 59))).toBe(true)
  })

  it('is false on the 29th and on 1 October', () => {
    expect(isBirthday(new Date(2026, 8, 29, 23, 59, 59))).toBe(false)
    expect(isBirthday(new Date(2026, 9, 1, 0, 0, 0))).toBe(false)
  })

  it('is true in any year', () => {
    for (const year of [1999, 2024, 2026, 2031, 2099]) {
      expect(isBirthday(new Date(year, 8, 30, 12, 0, 0)), String(year)).toBe(true)
    }
  })

  // Instants chosen so the UTC calendar day and the local one disagree.
  it('is true just after local midnight, when UTC still says the 29th', () => {
    const instant = new Date('2026-09-30T00:30:00+05:30')
    expect(instant.getUTCDate()).toBe(29)
    expect(isBirthday(instant)).toBe(true)
  })

  it('is false just after local midnight on 1 October, when UTC still says the 30th', () => {
    const instant = new Date('2026-10-01T02:00:00+05:30')
    expect(instant.getUTCDate()).toBe(30)
    expect(isBirthday(instant)).toBe(false)
  })

  it('is false late on the 29th, when UTC has not reached the 30th either', () => {
    const instant = new Date('2026-09-29T23:00:00+05:30')
    expect(isBirthday(instant)).toBe(false)
  })
})

describe('the day a play is recorded against', () => {
  it('is the local date, not the UTC one', () => {
    // 00:30 in Kolkata on the 30th is still the 29th in UTC. Recording the
    // UTC date here would let the video play twice on the same evening.
    expect(localDateKey(new Date('2026-09-30T00:30:00+05:30'))).toBe('2026-09-30')
    expect(localDateKey(new Date('2026-10-01T02:00:00+05:30'))).toBe('2026-10-01')
  })

  it('pads month and day, so keys sort and compare as strings', () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
    expect(localDateKey(new Date(2026, 11, 31, 12, 0))).toBe('2026-12-31')
  })
})
