import { GOLDFISH, RACCOON } from './paths'
import { GoldfishShapes, RaccoonShapes } from './mark'

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
  if (kind === 'raccoon') {
    return (
      <svg className="empty-art" width={SIZE} height={SIZE} viewBox={RACCOON.viewBox} aria-hidden="true">
        <RaccoonShapes />
      </svg>
    )
  }
  if (kind === 'goldfish') {
    return (
      <svg
        className="empty-art"
        width={SIZE}
        height={SIZE * 0.64}
        viewBox={GOLDFISH.viewBox}
        aria-hidden="true"
      >
        <GoldfishShapes />
      </svg>
    )
  }
  return (
    <svg className="empty-art" width={SIZE * 1.6} height={SIZE} viewBox="0 0 170 100" aria-hidden="true">
      <g transform="translate(0 4) scale(0.92)">
        <RaccoonShapes />
      </g>
      <g transform="translate(92 42) scale(0.78)">
        <GoldfishShapes />
      </g>
    </svg>
  )
}
