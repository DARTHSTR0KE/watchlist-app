import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  awayLong,
  fishAsleep,
  openedTogether,
  raccoonUpLate,
  tiredFish,
} from '../ambient/ambient'
import { loadOpenSignals } from '../events/presence'

/**
 * Past this, anything still on its way is ignored for this splash. The
 * pair are on screen by 0.8s and the lines by 1.4s; an answer later than
 * that would change a picture already being looked at, so it simply
 * doesn't. Nothing here is ever waited on.
 */
export const SPLASH_DEADLINE_MS = 1200

export interface SplashAmbient {
  // The pair asleep: away a fortnight or more.
  asleep: boolean
  fishAsleep: boolean
  fishTired: boolean
  moon: boolean
  // The two of you opened it within ninety seconds of each other.
  together: boolean
}

function inTime(startedAt: number): boolean {
  return performance.now() - startedAt <= SPLASH_DEADLINE_MS
}

export function useSplashAmbient(): SplashAmbient {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [now] = useState(() => new Date())
  const [startedAt] = useState(() => performance.now())
  const [signals, setSignals] = useState<{
    away: boolean
    tired: boolean
    together: boolean
  } | null>(null)


  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void loadOpenSignals(userId).then((opened) => {
      if (cancelled || !inTime(startedAt)) return
      setSignals({
        away: awayLong(opened.previousOpenAt, opened.openedAt),
        tired: tiredFish(opened.opensBefore),
        together: openedTogether(opened.partnerLastOpenAt, opened.openedAt),
      })
    })
    return () => {
      cancelled = true
    }
  }, [userId, startedAt])

  const away = signals?.away ?? false
  const together = signals?.together ?? false
  return {
    asleep: away && !together,
    fishAsleep: fishAsleep(now) || away,
    fishTired: signals?.tired ?? false,
    moon: raccoonUpLate(now),
    together,
  }
}
