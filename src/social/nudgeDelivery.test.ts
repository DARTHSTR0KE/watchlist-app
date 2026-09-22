import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Nudge } from './nudges'

/**
 * The module holds one decision per document load, so each test needs its
 * own copy of it rather than whatever the previous test left behind.
 */
async function freshDelivery() {
  vi.resetModules()
  return import('./nudgeDelivery')
}

const from = (fromUser: string, onSplash = true): Nudge => ({
  fromUser,
  message: 'come watch',
  createdAt: null,
  onSplash,
})

describe('a nudge is delivered once, by one route', () => {
  let delivery: Awaited<ReturnType<typeof freshDelivery>>

  beforeEach(async () => {
    delivery = await freshDelivery()
  })

  it('goes to the banner when nothing has claimed it — a resumed app has no splash', () => {
    expect(delivery.handledElsewhere(from('ac'))).toBe(false)
  })

  it('is hidden from the banner while the splash holds it', () => {
    expect(delivery.claimForSplash(from('ac'))).toBe(true)
    expect(delivery.handledElsewhere(from('ac'))).toBe(true)
  })

  it('goes back to the banner when the splash is skipped before it could be read', () => {
    delivery.claimForSplash(from('ac'))
    delivery.releaseClaim()
    expect(delivery.handledElsewhere(from('ac'))).toBe(false)
  })

  it('never returns to the banner once it has been spoken', () => {
    delivery.claimForSplash(from('ac'))
    delivery.markSpoken('ac')
    expect(delivery.handledElsewhere(from('ac'))).toBe(true)
  })

  it('cannot be claimed a second time after being spoken', () => {
    delivery.claimForSplash(from('ac'))
    delivery.markSpoken('ac')
    expect(delivery.claimForSplash(from('ac'))).toBe(false)
  })

  it('is never lost: every path ends either spoken or on the banner', () => {
    // Skipped early, then a later load speaks it in full.
    delivery.claimForSplash(from('ac'))
    delivery.releaseClaim()
    expect(delivery.handledElsewhere(from('ac'))).toBe(false)

    expect(delivery.claimForSplash(from('ac'))).toBe(true)
    delivery.markSpoken('ac')
    expect(delivery.handledElsewhere(from('ac'))).toBe(true)
  })

  it('leaves someone else\u2019s nudge alone', () => {
    delivery.claimForSplash(from('ac'))
    delivery.markSpoken('ac')
    expect(delivery.handledElsewhere(from('someone-else'))).toBe(false)
  })

  it('has nothing to hide when there is no nudge', () => {
    expect(delivery.handledElsewhere(null)).toBe(false)
  })

  it('releasing nothing is not an event', () => {
    const seen = vi.fn()
    delivery.subscribeDelivery(seen)
    delivery.releaseClaim()
    expect(seen).not.toHaveBeenCalled()
  })

  it('tells the banner the moment the splash lets go', () => {
    const seen = vi.fn()
    delivery.subscribeDelivery(seen)
    delivery.claimForSplash(from('ac'))
    expect(seen).toHaveBeenCalledTimes(1)
    delivery.releaseClaim()
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it('stops telling a listener that has unsubscribed', () => {
    const seen = vi.fn()
    const stop = delivery.subscribeDelivery(seen)
    stop()
    delivery.claimForSplash(from('ac'))
    expect(seen).not.toHaveBeenCalled()
  })
})
