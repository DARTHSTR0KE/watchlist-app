import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { dismissNudge, loadNudge } from '../social/nudges'
import { claimForSplash, markSpoken, releaseClaim } from '../social/nudgeDelivery'
import { parseMascot } from './mascots'
import type { Mascot } from './mascots'
import { supabase } from '../lib/supabaseClient'
import type { Nudge } from '../social/nudges'

// It has to be on screen this long before it counts as delivered. Anything
// less and a skip would swallow the message.
export const SPOKEN_MIN_VISIBLE_MS = 1500

export interface SpokenNudge {
  nudge: Nudge
  // The sender's animal, read from their profiles row.
  speaker: Mascot | null
}

/**
 * The nudge the splash is going to speak, if there is one.
 *
 * Fetched alongside the splash rather than before it: nothing here delays
 * the animation, and if it arrives too late to be read it simply isn't
 * claimed and the banner gets it instead.
 *
 * `onVisible` must be called once the bubble is actually showing — the
 * clock for "long enough to read" starts then, not at mount.
 */
export function useSpokenNudge(): {
  spoken: SpokenNudge | null
  onVisible: () => void
} {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [spoken, setSpoken] = useState<SpokenNudge | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const deliveredRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    void (async () => {
      const nudge = await loadNudge(userId).catch(() => null)
      if (cancelled || !nudge) return
      if (!claimForSplash(nudge)) return

      const { data } = await supabase
        .from('profiles')
        .select('mascot')
        .eq('id', nudge.fromUser)
        .maybeSingle()
      if (cancelled) {
        releaseClaim()
        return
      }
      setSpoken({ nudge, speaker: parseMascot(data?.mascot) })
    })()

    return () => {
      cancelled = true
    }
  }, [userId])

  // Whatever happens — skip, unmount, the splash simply ending — an unmet
  // claim is released so the banner picks it up.
  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current)
      if (!deliveredRef.current) releaseClaim()
    }
  }, [])

  const onVisible = () => {
    if (!spoken || deliveredRef.current || timerRef.current !== undefined) return
    timerRef.current = window.setTimeout(() => {
      deliveredRef.current = true
      markSpoken(spoken.nudge.fromUser)
      // Read is read: it does not come back in the banner afterwards.
      void dismissNudge(userId, spoken.nudge.fromUser).catch(() => {})
    }, SPOKEN_MIN_VISIBLE_MS)
  }

  return { spoken, onVisible }
}
