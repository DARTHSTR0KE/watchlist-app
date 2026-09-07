import { useEffect, useRef } from 'react'
import type { WheelItem } from './titles'
import {
  SEGMENT_COLORS,
  SEGMENT_TEXT_COLORS,
  describeRingSlicePath,
  polarToCartesian,
} from './wheelMath'
import { truncateToWidth } from '../utils/truncateText'
import { buildPosterUrl } from './posters'
import type { ImageStatus } from './usePosterImages'

interface SpinWheelProps {
  items: WheelItem[]
  rotation: number
  reduceMotion: boolean
  imageStatuses: Record<string, ImageStatus>
  onSpinEnd: () => void
  onSpin: () => void
  spinDisabled: boolean
}

const SIZE = 320
const CENTER = SIZE / 2

// Physical-wheel geometry: a thick outer bezel, a ring of wedges running
// from an inner radius out to the bezel's inner edge (nothing converges to
// a point), and a hub capping the middle.
const BEZEL_OUTER = 156
const BEZEL_INNER = 136
const WEDGE_OUTER = BEZEL_INNER
const WEDGE_INNER = WEDGE_OUTER * 0.25
const HUB_RADIUS = WEDGE_INNER + 2

const LABEL_RADIUS = WEDGE_INNER + (WEDGE_OUTER - WEDGE_INNER) * 0.55
const FONT_SIZE = 13
const LABEL_FONT = `600 ${FONT_SIZE}px system-ui, -apple-system, "Segoe UI", sans-serif`

const STRUCTURE_COLOR = '#EFE6D6'
const DIVIDER_WIDTH = 5
const DIVIDER_COLOR = STRUCTURE_COLOR
const BEZEL_COLOR = '#0e0e12'
const FLAPPER_FILL = '#0e0e12'
const FLAPPER_STROKE = '#f5c451'

// The flapper pivots at the top of the bezel and its tip overlaps a little
// into the wedge ring, so it visibly rides over whatever's spinning under it.
const FLAPPER_PIVOT = { x: CENTER, y: CENTER - BEZEL_OUTER }
const FLAPPER_TIP_Y = FLAPPER_PIVOT.y + (BEZEL_OUTER - (WEDGE_OUTER - 14))
const FLAPPER_HALF_WIDTH = 10
const FLAPPER_POINTS = `${FLAPPER_PIVOT.x - FLAPPER_HALF_WIDTH},${FLAPPER_PIVOT.y} ${
  FLAPPER_PIVOT.x + FLAPPER_HALF_WIDTH
},${FLAPPER_PIVOT.y} ${FLAPPER_PIVOT.x},${FLAPPER_TIP_Y}`

// Matches the CSS transition on the rotating group below — kept as a local
// constant so the tick loop knows when to stop polling. Spin physics and
// duration themselves live in App.tsx and are untouched.
const SPIN_DURATION_MS = 4000
const TICK_VIBRATION_MS = 8
const TICK_DEFLECTION_DEG = -12

// Standard cubic-bezier timing-function solver (the same algorithm browsers
// use for CSS `cubic-bezier()`), matching the curve on the rotating group's
// transition below. Used to predict the wheel's progress analytically —
// reading the live rendered transform back out via getComputedStyle proved
// unreliable, so the tick loop never touches the DOM to find out "where" the
// wheel visually is, only "where the same curve says it should be by now".
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1
  const c = (a1: number) => 3 * a1
  const calc = (t: number, a1: number, a2: number) => ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t
  const slope = (t: number, a1: number, a2: number) => 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1)

  const getTForX = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const currentSlope = slope(t, p1x, p2x)
      if (currentSlope === 0) return t
      t -= (calc(t, p1x, p2x) - x) / currentSlope
    }
    return t
  }

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : calc(getTForX(x), p1y, p2y))
}

const spinEasing = cubicBezier(0.16, 1, 0.3, 1)

function deflectFlapper(el: SVGGElement) {
  el.animate(
    [
      { transform: 'rotate(0deg)' },
      { transform: `rotate(${TICK_DEFLECTION_DEG}deg)`, offset: 0.35 },
      { transform: 'rotate(0deg)' },
    ],
    { duration: 180, easing: 'cubic-bezier(0.36, 0.07, 0.19, 0.97)' },
  )
  navigator.vibrate?.(TICK_VIBRATION_MS)
}

export function SpinWheel({
  items,
  rotation,
  reduceMotion,
  imageStatuses,
  onSpinEnd,
  onSpin,
  spinDisabled,
}: SpinWheelProps) {
  const count = items.length
  const segmentAngle = count > 0 ? 360 / count : 0

  const flapperRef = useRef<SVGGElement>(null)
  // Tracks the rotation the wheel was AT before the current `rotation` prop
  // (the spin's target) took effect, so the tick loop knows the start/end of
  // the range the easing curve is interpolating across.
  const previousRotationRef = useRef(0)

  // Drives the flapper's per-divider deflection + tick vibration by predicting
  // the wheel's progress through the same cubic-bezier curve as the CSS
  // transition, from elapsed time alone — not by reading the live rendered
  // transform back out, which proved unreliable. Purely cosmetic/haptic: it
  // never touches the spin state machine in App.tsx.
  useEffect(() => {
    const startRotation = previousRotationRef.current
    const endRotation = rotation
    previousRotationRef.current = rotation

    if (reduceMotion || endRotation === startRotation || count === 0) return
    const flapper = flapperRef.current
    if (!flapper) return

    const startTime = performance.now()
    let lastDividerCount = Math.floor(startRotation / segmentAngle)
    let rafId: number

    const step = () => {
      const elapsed = performance.now() - startTime
      const tFraction = Math.min(elapsed / SPIN_DURATION_MS, 1)
      const eased = spinEasing(tFraction)
      const predictedRotation = startRotation + (endRotation - startRotation) * eased

      const currentDividerCount = Math.floor(predictedRotation / segmentAngle)
      if (currentDividerCount > lastDividerCount) {
        lastDividerCount = currentDividerCount
        deflectFlapper(flapper)
      }

      if (tFraction < 1) rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [rotation, reduceMotion, count, segmentAngle])

  return (
    <div className="wheel-wrap">
      <svg
        className="wheel-svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label="Spin wheel of film titles"
      >
        <defs>
          <radialGradient id="poster-scrim" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.15" />
            <stop offset="60%" stopColor="#000000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.78" />
          </radialGradient>
          <radialGradient id="wedge-recess" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </radialGradient>
          {items.map((item, i) => {
            const start = i * segmentAngle
            const end = start + segmentAngle
            const path = describeRingSlicePath(CENTER, CENTER, WEDGE_INNER, WEDGE_OUTER, start, end)
            return (
              <clipPath id={`wedge-clip-${item.id}`} key={item.id}>
                <path d={path} />
              </clipPath>
            )
          })}
        </defs>

        {/* Bezel: a thick, flat, dark ring the wedges sit inside. */}
        <circle cx={CENTER} cy={CENTER} r={BEZEL_OUTER} fill={BEZEL_COLOR} />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={BEZEL_OUTER - 1}
          fill="none"
          stroke={STRUCTURE_COLOR}
          strokeOpacity={0.55}
          strokeWidth={2}
        />

        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transition: reduceMotion ? 'none' : 'transform 4000ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onTransitionEnd={(event) => {
            if (event.propertyName === 'transform') onSpinEnd()
          }}
        >
          {items.map((item, i) => {
            const start = i * segmentAngle
            const end = start + segmentAngle
            const mid = start + segmentAngle / 2
            const path = describeRingSlicePath(CENTER, CENTER, WEDGE_INNER, WEDGE_OUTER, start, end)
            const labelPos = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, mid)
            const maxLabelWidth =
              2 * LABEL_RADIUS * Math.sin((segmentAngle / 2) * (Math.PI / 180)) * 0.82
            const label = truncateToWidth(item.title, maxLabelWidth, LABEL_FONT)
            const fill = SEGMENT_COLORS[i % 2]

            const posterUrl = buildPosterUrl(item.posterPath)
            const showPoster = posterUrl !== null && imageStatuses[item.id] === 'loaded'
            // The scrim darkens every wedge it covers, so poster wedges
            // always get light text regardless of the flat-color fallback below.
            const textColor = showPoster ? SEGMENT_TEXT_COLORS[0] : SEGMENT_TEXT_COLORS[i % 2]

            // Centroid sits at the ring's mid-radius along the segment's
            // mid-angle — always inside the wedge, which is where the
            // poster's own middle gets pinned. The box is sized so it fully
            // covers the wedge (inner to outer corners) at any segment count.
            const centroidRadius = (WEDGE_INNER + WEDGE_OUTER) / 2
            const centroid = polarToCartesian(CENTER, CENTER, centroidRadius, mid)
            const halfSegRad = ((segmentAngle / 2) * Math.PI) / 180
            const outerCornerDistance = Math.sqrt(
              WEDGE_OUTER * WEDGE_OUTER +
                centroidRadius * centroidRadius -
                2 * WEDGE_OUTER * centroidRadius * Math.cos(halfSegRad),
            )
            const innerCornerDistance = Math.sqrt(
              WEDGE_INNER * WEDGE_INNER +
                centroidRadius * centroidRadius -
                2 * WEDGE_INNER * centroidRadius * Math.cos(halfSegRad),
            )
            const coverHalfSize = Math.max(outerCornerDistance, innerCornerDistance) * 1.08
            const clipUrl = `url(#wedge-clip-${item.id})`

            return (
              <g key={item.id}>
                <path d={path} fill={fill} stroke="#0b0b0e" strokeWidth={1} />
                {showPoster && (
                  <>
                    <image
                      href={posterUrl}
                      x={centroid.x - coverHalfSize}
                      y={centroid.y - coverHalfSize}
                      width={coverHalfSize * 2}
                      height={coverHalfSize * 2}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={clipUrl}
                    />
                    <rect
                      x={0}
                      y={0}
                      width={SIZE}
                      height={SIZE}
                      fill="url(#poster-scrim)"
                      clipPath={clipUrl}
                    />
                  </>
                )}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={textColor}
                  fontSize={FONT_SIZE}
                  fontWeight={600}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${mid} ${labelPos.x} ${labelPos.y})`}
                >
                  {label}
                </text>
              </g>
            )
          })}

          {/* Dividers on top of every wedge's poster/scrim, so each panel
              reads as separate rather than bleeding into its neighbour. */}
          {items.map((_, i) => {
            const angle = i * segmentAngle
            const innerPt = polarToCartesian(CENTER, CENTER, WEDGE_INNER, angle)
            const outerPt = polarToCartesian(CENTER, CENTER, WEDGE_OUTER, angle)
            return (
              <line
                key={`divider-${angle}`}
                x1={innerPt.x}
                y1={innerPt.y}
                x2={outerPt.x}
                y2={outerPt.y}
                stroke={DIVIDER_COLOR}
                strokeWidth={DIVIDER_WIDTH}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* Static shadow ring: makes the wedges look recessed under the bezel. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={WEDGE_OUTER}
          fill="url(#wedge-recess)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Flapper: fixed pivot, deflects per divider via the effect above. */}
        <g ref={flapperRef} style={{ transformOrigin: `${FLAPPER_PIVOT.x}px ${FLAPPER_PIVOT.y}px` }}>
          <polygon points={FLAPPER_POINTS} fill={FLAPPER_FILL} stroke={FLAPPER_STROKE} strokeWidth={1.5} />
          <circle cx={FLAPPER_PIVOT.x} cy={FLAPPER_PIVOT.y} r={4} fill={FLAPPER_FILL} stroke={FLAPPER_STROKE} strokeWidth={1.5} />
        </g>
      </svg>

      {/* Hub doubles as the spin button: a real element (not an SVG shape)
          so it's a proper tap target, fixed above the wedges since it lives
          outside the rotating group entirely. */}
      <button
        type="button"
        className="wheel-hub-button"
        style={{ width: `${(HUB_RADIUS * 2 * 100) / SIZE}%`, height: `${(HUB_RADIUS * 2 * 100) / SIZE}%` }}
        onClick={onSpin}
        disabled={spinDisabled}
        aria-label="Spin the wheel"
      >
        SPIN
      </button>
    </div>
  )
}
