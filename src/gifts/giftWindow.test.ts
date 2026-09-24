import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabaseClient', () => ({ supabase: {} }))

const { giftWindow, giftYear, promptDue, tooBig, TRACK_MAX_BYTES, MESSAGE_MAX_BYTES } =
  await import('./giftWindow')
const { giftPath, hasLeftAnything, titleFromFileName, NO_GIFT } = await import('./gifts')

// Noon in India, so the day is never in doubt.
const ist = (month: number, day: number, hour = 12) =>
  new Date(`2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+05:30`)

describe('the gift window', () => {
  it('is not open yet all year until 1 December', () => {
    expect(giftWindow(ist(11, 30))).toBe('before')
    expect(giftWindow(ist(1, 5))).toBe('before')
  })

  it('is open 1 to 14 December, and closed from the 15th', () => {
    expect(giftWindow(ist(12, 1))).toBe('open')
    expect(giftWindow(ist(12, 14, 23))).toBe('open')
    expect(giftWindow(ist(12, 15, 0))).toBe('closed')
    expect(giftWindow(ist(12, 31))).toBe('closed')
  })

  it('turns over at midnight in India, not UTC', () => {
    // 19:00 UTC on 14 December is half past midnight on the 15th in India.
    expect(giftWindow(new Date('2026-12-14T19:00:00Z'))).toBe('closed')
    expect(giftWindow(new Date('2026-11-30T19:00:00Z'))).toBe('open')
  })

  it('belongs to the year of the Wrapped it plays in', () => {
    expect(giftYear(ist(12, 3))).toBe(2026)
  })
})

describe('the prompt', () => {
  it('is due from the 1st, the 7th and the 13th, and never outside the window', () => {
    expect(promptDue(ist(11, 30))).toBeNull()
    expect(promptDue(ist(12, 1))).toBe(1)
    expect(promptDue(ist(12, 6))).toBe(1)
    expect(promptDue(ist(12, 7))).toBe(7)
    expect(promptDue(ist(12, 13))).toBe(13)
    expect(promptDue(ist(12, 14))).toBe(13)
    expect(promptDue(ist(12, 15))).toBeNull()
  })
})

describe('files', () => {
  it('stops at the limits', () => {
    expect(tooBig(TRACK_MAX_BYTES - 1, TRACK_MAX_BYTES)).toBe(false)
    expect(tooBig(TRACK_MAX_BYTES, TRACK_MAX_BYTES)).toBe(true)
    expect(tooBig(26 * 1024 * 1024, MESSAGE_MAX_BYTES)).toBe(true)
  })

  it('stores each at its fixed path', () => {
    expect(giftPath('u1', 2026, 'track')).toBe('u1/2026/track')
    expect(giftPath('u1', 2026, 'message')).toBe('u1/2026/message')
  })

  it('names a song after its file', () => {
    expect(titleFromFileName('Kho Gaye Hum Kahan.mp3')).toBe('Kho Gaye Hum Kahan')
    expect(titleFromFileName('no-extension')).toBe('no-extension')
  })

  it('counts a song or a sent message as something left', () => {
    expect(hasLeftAnything(NO_GIFT)).toBe(false)
    expect(hasLeftAnything({ ...NO_GIFT, trackPath: 'u1/2026/track' })).toBe(true)
    expect(hasLeftAnything({ ...NO_GIFT, messageAt: '2026-12-02T10:00:00Z' })).toBe(true)
  })
})
