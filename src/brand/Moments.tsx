import { useId } from 'react'
import type { ReactNode } from 'react'
import { BIN, MOON, RACCOON } from './paths'
import {
  BinShapes,
  BowlShapes,
  MoonShapes,
  PartyHat,
  RaccoonSeatedShapes,
  RaccoonShapes,
  SackShapes,
} from './mark'
import { BRAND } from './paths'
import { isBirthday } from '../birthday/birthdayDate'
import { prefersReducedMotion } from './coldStart'
import { Tappable } from './Tappable'

/**
 * Moments, not decoration. Each of these belongs to one thing the app is
 * doing and appears only while that is true.
 *
 * These are the exception to reading profiles.mascot: the joke picks the
 * animal. A heist wants a bandit and a three-second memory wants a fish,
 * whoever's phone it is on.
 *
 * Every one of them is a sibling of the thing it comments on. Nothing here
 * is awaited, gates a button, or sits in front of an action — reduced
 * motion drops to the still and the moment still reads.
 */

function Hat({ transform }: { transform: string }) {
  if (!isBirthday()) return null
  return (
    <g transform={transform}>
      <PartyHat />
    </g>
  )
}

/** Import: a masked bandit carrying your films off in a sack. */
export function HeistMoment({ done, total }: { done: number; total: number }) {
  const still = prefersReducedMotion()
  // Ten notches for however far along it is, so the pile grows with the
  // count rather than with a timer.
  const filled = total > 0 ? Math.round((done / total) * 10) : 0

  return (
    <svg className="moment moment-heist" viewBox="0 0 210 150" aria-hidden="true">
      <g className={still ? undefined : 'heist-walk'}>
        <g transform="translate(0 8) scale(0.92)">
          <RaccoonSeatedShapes />
        </g>
        <g transform="translate(112 52) scale(0.86)">
          <SackShapes filled={filled} />
        </g>
        <Hat transform="translate(30 -14) scale(0.52)" />
      </g>
    </svg>
  )
}

/** Nothing matched: head-first in the bin, having a look. */
export function BinMoment() {
  const still = prefersReducedMotion()
  return (
    <Tappable who="raccoon">
      <svg className="moment moment-bin" viewBox={BIN.viewBox} aria-hidden="true">
        <g className={still ? undefined : 'bin-rummage'}>
          <BinShapes />
        </g>
      </svg>
    </Tappable>
  )
}

/** The goldfish in its bowl, swimming, circling, or tipped over. */
export function BowlMoment({
  mood = 'swim',
  size = 44,
  className,
}: {
  mood?: 'swim' | 'loop' | 'still' | 'tipped'
  size?: number
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  const still = prefersReducedMotion()
  const moving = still ? 'still' : mood

  return (
    <Tappable who="goldfish">
      <svg
        className={`moment moment-bowl${className ? ` ${className}` : ''}`}
        width={size}
        height={size}
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <BowlShapes
          uid={uid}
          swimming={moving === 'swim'}
          loop={moving === 'loop'}
          tipped={mood === 'tipped'}
        />
        {mood === 'tipped' && (
          // What came out of it. Drawn outside the glass on purpose.
          <path
            className="bowl-spill"
            d="M6 88 C24 96 52 98 78 92 C60 100 24 100 6 88 Z"
            fill="rgba(110, 123, 166, 0.42)"
          />
        )}
        <Hat transform="translate(22 -6) scale(0.56)" />
      </svg>
    </Tappable>
  )
}

/** Out of rerolls: a shrug. That's the one. */
export function ShrugMoment() {
  const still = prefersReducedMotion()
  return (
    <Tappable who="raccoon">
      <svg className="moment moment-shrug" viewBox={RACCOON.viewBox} aria-hidden="true">
        <g className={still ? undefined : 'shrug-lift'}>
          <RaccoonShrugShapes />
        </g>
        <Hat transform="translate(14 -14) scale(0.44)" />
      </svg>
    </Tappable>
  )
}

// The head with two short arms thrown out to the sides, which is all a
// shrug needs at this size.
function RaccoonShrugShapes() {
  return (
    <g>
      {/* Out past the head, which fills the grid to y=88 — anything
          closer in is simply behind it. */}
      <path d="M18 74 L1 58" stroke={BRAND.fur} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path
        d="M82 74 L99 58"
        stroke={BRAND.fur}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      <g transform="translate(12 6) scale(0.76)">
        <RaccoonShapes />
      </g>
    </g>
  )
}

/** Small hours: a moon, and someone who is still up. */
export function NightMoment() {
  return (
    <span className="moment-night">
      <svg className="moment moment-moon" viewBox={MOON.viewBox} aria-hidden="true">
        <MoonShapes />
      </svg>
      <Tappable who="raccoon">
        <svg className="moment moment-awake" viewBox={RACCOON.viewBox} aria-hidden="true">
          <RaccoonShapes />
          <Hat transform="translate(14 -14) scale(0.44)" />
        </svg>
      </Tappable>
    </span>
  )
}

/** Wraps a line of text with its moment beside it. */
export function MomentLine({ art, children }: { art: ReactNode; children: ReactNode }) {
  return (
    <div className="moment-line">
      {art}
      <p className="moment-words">{children}</p>
    </div>
  )
}
