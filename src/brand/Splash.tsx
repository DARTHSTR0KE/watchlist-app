import { useEffect, useState } from 'react'
import { GoldfishShapes, RaccoonShapes } from './mark'
import { prefersReducedMotion } from './coldStart'

// Everything below has to finish inside this. Held deliberately short:
// a splash is a greeting, not a gate.
const FULL_MS = 1350
const STILL_MS = 400

/**
 * The raccoon scoops the fish up and the pair leave together, taking the
 * wordmark with them.
 *
 * It renders over the app rather than in front of it — the app is already
 * mounting and loading underneath, so this never delays anything. Tapping
 * anywhere ends it early.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduced = prefersReducedMotion()
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(onDone, STILL_MS)
      return () => window.clearTimeout(t)
    }
    // The beat before the scoop, then the exit.
    const scoop = window.setTimeout(() => setLeaving(true), 520)
    const done = window.setTimeout(onDone, FULL_MS)
    return () => {
      window.clearTimeout(scoop)
      window.clearTimeout(done)
    }
  }, [onDone, reduced])

  return (
    <div
      className={`splash${leaving ? ' splash-leaving' : ''}${reduced ? ' splash-still' : ''}`}
      onClick={onDone}
      role="presentation"
    >
      <div className="splash-stage">
        <svg className="splash-pair" viewBox="0 0 260 120" aria-hidden="true">
          {/* One group, so the scoop carries the fish with the raccoon
              rather than animating two things that have to agree. */}
          <g className="splash-carry">
            <g transform="translate(70 8) scale(1.02)">
              <RaccoonShapes />
            </g>
            <g className="splash-fish" transform="translate(146 62) scale(0.86)">
              <GoldfishShapes />
            </g>
          </g>
        </svg>
      </div>

      <div className="splash-words">
        <p className="splash-name">Chhobidam</p>
        <p className="splash-gloss">chhobi + padam</p>
        <p className="splash-tag">A Bong-Mallu partnership</p>
      </div>
    </div>
  )
}
