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
import { ensureAudioContext, playTick } from './tickSound'

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

// "Bezel with pegs": a solid off-white band rings the wheel from 82% of the
// radius out to 100%, carrying a dark peg at every divider angle. The wedges
// run from 31% to 82%, flush against the band's inner edge, and a hub caps
// the middle. Band, wedges and pegs all rotate together — only the flapper
// and the hub stay fixed.
const OUTER_RADIUS = 156
const BAND_INNER_RADIUS = OUTER_RADIUS * 0.82
const WEDGE_OUTER_RADIUS = BAND_INNER_RADIUS
const WEDGE_INNER_RADIUS = OUTER_RADIUS * 0.31
const HUB_RADIUS = OUTER_RADIUS * 0.14
// Amber glow behind the hub, holding it apart from whatever backdrop shows
// through the wheel's open centre.
const HUB_HALO_RADIUS = HUB_RADIUS * 1.8
const HUB_EDGE_OFFSET = `${(HUB_RADIUS / HUB_HALO_RADIUS) * 100}%`
const PEG_RING_RADIUS = (BAND_INNER_RADIUS + OUTER_RADIUS) / 2
const BAND_HAIRLINE_RADIUS = OUTER_RADIUS * 0.97

const LABEL_RADIUS = WEDGE_INNER_RADIUS + (WEDGE_OUTER_RADIUS - WEDGE_INNER_RADIUS) * 0.55
const FONT_SIZE = 13
const LABEL_FONT = `600 ${FONT_SIZE}px system-ui, -apple-system, "Segoe UI", sans-serif`

const STRUCTURE_COLOR = '#EFE6D6'
const PEG_COLOR = '#0b0b0e'
const FLAPPER_FILL = '#0e0e12'
const FLAPPER_STROKE = '#f5c451'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// The divider is an angular gap between wedges rather than a fixed-width
// line, so it thins as the wheel fills up instead of swallowing the posters.
function gapDegreesFor(count: number): number {
  return clamp(20 / count, 0.9, 2.6)
}

// ~2px at 8 segments, shrinking as the count climbs.
function pegRadiusFor(count: number): number {
  return clamp(16 / count, 0.75, 2)
}

// The flapper pivots at the wheel's outer edge and reaches down to the middle
// of the band, so its tip sits exactly where the pegs pass under it.
const FLAPPER_PIVOT = { x: CENTER, y: CENTER - OUTER_RADIUS }
const FLAPPER_TIP_Y = FLAPPER_PIVOT.y + (OUTER_RADIUS - PEG_RING_RADIUS)
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
  const halfGap = gapDegreesFor(count || 1) / 2
  const pegRadius = pegRadiusFor(count || 1)

  const flapperRef = useRef<SVGGElement>(null)
  // Tracks the rotation the wheel was AT before the current `rotation` prop
  // (the spin's target) took effect, so the tick loop knows the start/end of
  // the range the easing curve is interpolating across.
  const previousRotationRef = useRef(0)

  // Drives the flapper's per-divider deflection, the tick sound and the tick
  // vibration by predicting the wheel's progress through the same
  // cubic-bezier curve as the CSS transition, from elapsed time alone — not
  // by reading the live rendered transform back out, which proved
  // unreliable. All three fire off the same peg-crossing event so they stay
  // in sync as the wheel slows. Purely cosmetic/haptic: it never touches the
  // spin state machine in App.tsx.
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
        playTick()
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
          <radialGradient id="hub-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5c451" stopOpacity="0.55" />
            <stop offset={HUB_EDGE_OFFSET} stopColor="#f5c451" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f5c451" stopOpacity="0" />
          </radialGradient>
          {items.map((item, i) => {
            const start = i * segmentAngle + halfGap
            const end = (i + 1) * segmentAngle - halfGap
            const path = describeRingSlicePath(
              CENTER,
              CENTER,
              WEDGE_INNER_RADIUS,
              WEDGE_OUTER_RADIUS,
              start,
              end,
            )
            return (
              <clipPath id={`wedge-clip-${item.id}`} key={item.id}>
                <path d={path} />
              </clipPath>
            )
          })}
        </defs>

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
          {/* One off-white ring from the wedges' inner edge to the rim: its
              outer 18% is the band, and the rest shows through the angular
              gaps between wedges. Drawn as a ring rather than a disc so the
              centre stays open to the page backdrop behind the wheel. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={(WEDGE_INNER_RADIUS + OUTER_RADIUS) / 2}
            fill="none"
            stroke={STRUCTURE_COLOR}
            strokeWidth={OUTER_RADIUS - WEDGE_INNER_RADIUS}
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={BAND_HAIRLINE_RADIUS}
            fill="none"
            stroke={PEG_COLOR}
            strokeOpacity={0.25}
            strokeWidth={1.5}
          />

          {items.map((item, i) => {
            const start = i * segmentAngle + halfGap
            const end = (i + 1) * segmentAngle - halfGap
            const mid = i * segmentAngle + segmentAngle / 2
            const path = describeRingSlicePath(
              CENTER,
              CENTER,
              WEDGE_INNER_RADIUS,
              WEDGE_OUTER_RADIUS,
              start,
              end,
            )
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
            const centroidRadius = (WEDGE_INNER_RADIUS + WEDGE_OUTER_RADIUS) / 2
            const centroid = polarToCartesian(CENTER, CENTER, centroidRadius, mid)
            const halfSegRad = ((segmentAngle / 2) * Math.PI) / 180
            const outerCornerDistance = Math.sqrt(
              WEDGE_OUTER_RADIUS * WEDGE_OUTER_RADIUS +
                centroidRadius * centroidRadius -
                2 * WEDGE_OUTER_RADIUS * centroidRadius * Math.cos(halfSegRad),
            )
            const innerCornerDistance = Math.sqrt(
              WEDGE_INNER_RADIUS * WEDGE_INNER_RADIUS +
                centroidRadius * centroidRadius -
                2 * WEDGE_INNER_RADIUS * centroidRadius * Math.cos(halfSegRad),
            )
            const coverHalfSize = Math.max(outerCornerDistance, innerCornerDistance) * 1.08
            const clipUrl = `url(#wedge-clip-${item.id})`

            return (
              <g key={item.id}>
                <path d={path} fill={fill} />
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

          {/* Pegs: one per divider angle, centred in the band, where the
              flapper strikes as the wheel turns. */}
          {items.map((_, i) => {
            const angle = i * segmentAngle
            const pos = polarToCartesian(CENTER, CENTER, PEG_RING_RADIUS, angle)
            return <circle key={`peg-${angle}`} cx={pos.x} cy={pos.y} r={pegRadius} fill={PEG_COLOR} />
          })}
        </g>

        {/* Halo behind the hub button, which sits over this as real HTML. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={HUB_HALO_RADIUS}
          fill="url(#hub-halo)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Flapper: fixed pivot, deflects per peg via the effect above. */}
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
        onClick={() => {
          // Created here, inside the tap, so it isn't born suspended.
          ensureAudioContext()
          onSpin()
        }}
        disabled={spinDisabled}
        aria-label="Spin the wheel"
      >
        SPIN
      </button>
    </div>
  )
}
