import { BRAND } from './paths'
import { GoldfishShapes, RaccoonShapes } from './mark'

/**
 * The launcher tile. The pair nearly fill it on purpose — at 48 pixels,
 * which is what Android draws, a polite margin turns them into two
 * unreadable smudges.
 *
 * `maskable` pulls everything into the middle 80%, because Android crops
 * the tile to whatever shape the launcher uses and anything in the outer
 * band is liable to be cut off.
 */
export function IconTile({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const inset = maskable ? 'translate(51.2 51.2) scale(0.8)' : undefined

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      {/* Full bleed: the crop must never expose a corner of nothing. */}
      <rect width="512" height="512" fill={BRAND.ground} />
      <rect width="512" height="512" rx="112" fill={BRAND.ground} />
      <g transform={inset}>
        <g transform="translate(18 16) scale(2.95)">
          <RaccoonShapes />
        </g>
        <g transform="translate(212 300) scale(2.78)">
          <GoldfishShapes />
        </g>
      </g>
    </svg>
  )
}
