import { useEffect } from 'react'
import { BowlShapes, RaccoonSeatedShapes } from './mark'
import { prefersReducedMotion } from './coldStart'

/**
 * One raccoon and one goldfish in its bowl, from the first frame to the
 * last. Nothing crossfades into anything and no drawing is swapped for
 * another version of itself partway through.
 *
 * The whole thing runs off a single five-second clock: every element gets
 * the same duration and differs only in which percentages it moves at, so
 * the reach, the lift, the walk and the text can't drift apart the way
 * separate timers would.
 *
 *   0.0-0.8  the pair fade in, already in position
 *   0.8-1.4  the name and the gloss fade in
 *   1.0      the skip hint appears
 *   1.4-2.0  the tagline fades in, and holds — ten words need reading time
 *   3.8-4.3  she turns and reaches
 *   4.3-4.6  the bowl is lifted against her chest, water staying level
 *   4.6-5.0  she walks off right carrying it; the text fades in place
 *
 * It renders over the app, which is already mounted and loading
 * underneath, so nothing waits on it and there is no blank frame when it
 * clears.
 */
const FULL_MS = 5000

// Long enough to take the composed picture in, and then out of the way.
const STILL_MS = 1500

export function Splash({ onDone }: { onDone: () => void }) {
  const reduced = prefersReducedMotion()

  useEffect(() => {
    const t = window.setTimeout(onDone, reduced ? STILL_MS : FULL_MS)
    return () => window.clearTimeout(t)
  }, [onDone, reduced])

  return (
    <div
      className={`splash${reduced ? ' splash-still' : ''}`}
      onPointerDown={onDone}
      role="presentation"
    >
      <div className="splash-stage">
        <svg className="splash-scene" viewBox="0 0 190 150" aria-hidden="true">
          {/* One group for the pair: once the fish is in his arms it
              travels with him rather than being animated alongside. */}
          <g className="sp-troupe">
            <g className="sp-raccoon">
              <RaccoonSeatedShapes />
            </g>
            {/* Placement inside, animation outside — a CSS transform
                replaces the attribute rather than composing with it.
                She picks up the bowl, not the fish: the fish is swimming
                in it from the first frame and never leaves it. */}
            <g className="sp-bowl">
              <g transform="translate(112 78) scale(0.66)">
                <BowlShapes uid="splash" swimming />
              </g>
            </g>
          </g>
        </svg>
      </div>

      {/* Fades where it stands. Nothing here moves sideways, which is what
          was clipping it mid-word against the edge of the screen. */}
      <div className="splash-words">
        <p className="splash-name">Chhobidam</p>
        <p className="splash-gloss">chhobi + padam</p>
        <p className="splash-tag">Indecisive about films. Never about you :3</p>
      </div>

      {/* Five seconds is long enough that it needs saying. */}
      <p className="splash-hint">tap to skip</p>
    </div>
  )
}
