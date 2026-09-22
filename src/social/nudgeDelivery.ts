import type { Nudge } from './nudges'

/**
 * One place decides whether a nudge is spoken on the splash or shown in the
 * banner, so the two can never both deliver it and never both skip it.
 *
 * The splash claims it first, because it runs first. A claim blocks the
 * banner. It then resolves one of two ways:
 *
 *   spoken   — the bubble was up for long enough to read, so it is done
 *   released — skipped too early, so the banner takes it instead
 *
 * The splash always resolves its claim, including when it unmounts, which
 * is what makes "never lost" true rather than hoped for.
 *
 * Module state rather than context: this is one decision per document load,
 * and the two sides of it are mounted in different parts of the tree.
 */

interface DeliveryState {
  // from_user of the nudge the splash is currently speaking.
  claimed: string | null
  // from_user of one that has been delivered and needs no banner.
  delivered: string | null
}

let state: DeliveryState = { claimed: null, delivered: null }
const listeners = new Set<() => void>()

function publish(next: DeliveryState) {
  state = next
  for (const listener of listeners) listener()
}

export function subscribeDelivery(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function deliverySnapshot(): DeliveryState {
  return state
}

// Short enough to read in a bubble, asked for by the sender, and not
// already handled.
export function claimForSplash(nudge: Nudge): boolean {
  if (!nudge.onSplash) return false
  if (state.delivered === nudge.fromUser) return false
  publish({ ...state, claimed: nudge.fromUser })
  return true
}

export function markSpoken(fromUser: string): void {
  publish({ claimed: null, delivered: fromUser })
}

// Skipped before it could be read: the banner has it now.
export function releaseClaim(): void {
  if (state.claimed === null) return
  publish({ ...state, claimed: null })
}

// Whether the banner should stay out of the way of this one.
export function handledElsewhere(nudge: Nudge | null): boolean {
  if (!nudge) return false
  return state.claimed === nudge.fromUser || state.delivered === nudge.fromUser
}
