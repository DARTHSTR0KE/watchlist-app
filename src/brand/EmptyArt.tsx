import { GOLDFISH, RACCOON } from './paths'
import { GoldfishShapes, RaccoonShapes } from './mark'
import { Tappable } from './Tappable'

/**
 * The pair turning up where a screen has nothing to show.
 *
 * Small, flat and inline with the sentence rather than a decorative panel
 * above it — an empty screen needs to say what would fill it, and the
 * drawing is part of that line, not an apology for it.
 *
 * Which of them appears is chosen per screen rather than randomly, so a
 * given empty state always looks the same, and no two adjacent ones are
 * the same drawing.
 */
export type EmptyArtKind = 'raccoon' | 'goldfish' | 'pair'

const SIZE = 34

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  const raccoon = (
    <Tappable who="raccoon">
      <svg className="empty-art" width={SIZE} height={SIZE} viewBox={RACCOON.viewBox} aria-hidden="true">
        <RaccoonShapes />
      </svg>
    </Tappable>
  )
  const goldfish = (
    <Tappable who="goldfish">
      <svg
        className="empty-art"
        width={SIZE}
        height={SIZE * 0.64}
        viewBox={GOLDFISH.viewBox}
        aria-hidden="true"
      >
        <GoldfishShapes />
      </svg>
    </Tappable>
  )
  if (kind === 'raccoon') return raccoon
  if (kind === 'goldfish') return goldfish
  // Two drawings rather than one, so each can be tapped on its own.
  return (
    <span className="empty-art-pair">
      {raccoon}
      {goldfish}
    </span>
  )
}
