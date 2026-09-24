import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { logEvent } from '../events/events'
import { tapLevel } from '../ambient/ambient'
import { prefersReducedMotion } from './coldStart'

// Taps closer together than this are one burst.
const BURST_GAP_MS = 1400

/**
 * An animal that notices being tapped. A tap or two gets something small
 * — a hop, a wiggle — and keeping at it gets something else. Nothing is
 * counted on screen and nothing is won.
 *
 * One tap_mascot event per burst, with how many taps it was, rather than
 * a row for every poke.
 *
 * Inside a button or link the tap belongs to the control, so it is left
 * alone: pressing "Nudge" isn't reaching for the fish.
 */
export function Tappable({
  who,
  children,
  className,
}: {
  who: 'raccoon' | 'goldfish'
  children: ReactNode
  className?: string
}) {
  const [taps, setTaps] = useState(0)
  // Bumped on every tap so the reaction restarts rather than being
  // swallowed by one already running.
  const [nonce, setNonce] = useState(0)
  const tapsRef = useRef(0)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
    if (event.currentTarget.parentElement?.closest('button, a')) return
    tapsRef.current += 1
    setTaps(tapsRef.current)
    setNonce((n) => n + 1)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      logEvent('tap_mascot', { detail: { who, taps: tapsRef.current } })
      tapsRef.current = 0
      setTaps(0)
    }, BURST_GAP_MS)
  }

  const level = tapLevel(taps)
  // Reduced motion gets a pose held for a moment instead of a movement.
  const still = prefersReducedMotion()
  const reaction =
    level === 0 ? '' : ` tap-${who}-${level === 2 ? 'big' : 'small'}${still ? ' tap-still' : ''}`

  return (
    <span className={`tappable${className ? ` ${className}` : ''}`} onClick={handleClick}>
      <span key={nonce} className={`tappable-inner${reaction}`}>
        {children}
      </span>
    </span>
  )
}
