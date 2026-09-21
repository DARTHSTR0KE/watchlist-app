import { useId } from 'react'
import { GOLDFISH, RACCOON } from './paths'
import { BowlShapes, GoldfishShapes, PartyHat, RaccoonShapes } from './mark'
import { isBirthday } from '../birthday/birthdayDate'
import type { Mascot as MascotName } from './mascots'

/**
 * A person's animal, wherever the app refers to that person. Which animal
 * that is comes from profiles.mascot and is passed in — this never decides
 * it, and an unknown value renders nothing at all rather than guessing.
 *
 * The hats are the one thing here that isn't about who someone is: on 30
 * September everyone wears one, wherever they appear.
 */
export function Mascot({
  who,
  size = 26,
  bowl = false,
  className,
}: {
  who: MascotName | null
  size?: number
  // The goldfish is a fish in a bowl anywhere it has room to be one.
  bowl?: boolean
  className?: string
}) {
  const uid = useId().replace(/:/g, '')
  if (!who) return null
  const party = isBirthday()

  if (who === 'goldfish' && bowl) {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
        <BowlShapes uid={uid} />
        {party && (
          <g transform="translate(20 -4) scale(0.6)">
            <PartyHat />
          </g>
        )}
      </svg>
    )
  }

  if (who === 'goldfish') {
    return (
      <svg
        width={size}
        height={size * 0.64}
        viewBox={GOLDFISH.viewBox}
        className={className}
        aria-hidden="true"
      >
        <GoldfishShapes />
        {party && (
          <g transform="translate(24 -16) scale(0.36)">
            <PartyHat />
          </g>
        )}
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={RACCOON.viewBox} className={className} aria-hidden="true">
      <RaccoonShapes />
      {party && (
        <g transform="translate(14 -14) scale(0.44)">
          <PartyHat />
        </g>
      )}
    </svg>
  )
}

/**
 * Both of them, side by side. Used where a thing belongs to the two of you
 * rather than to either — the together half of the watched screen, say.
 */
export function MascotPair({ size = 26 }: { size?: number }) {
  return (
    <span className="mascot-pair">
      <Mascot who="raccoon" size={size} />
      <Mascot who="goldfish" size={size} bowl />
    </span>
  )
}
