// Alternating segment fill colors and their matching readable text colors.
export const SEGMENT_COLORS = ['#1c1c24', '#f5c451']
export const SEGMENT_TEXT_COLORS = ['#f5f5f5', '#101014']

export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleFromTopDeg: number,
): { x: number; y: number } {
  const rad = (angleFromTopDeg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

export function describeSlicePath(
  cx: number,
  cy: number,
  r: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, startAngleDeg)
  const end = polarToCartesian(cx, cy, r, endAngleDeg)
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`
}

// A complete ring, for the single-film case. A 360-degree arc can't be drawn
// as one sector — its start and end points coincide — so this is two circles
// with evenodd winding, the inner one punching the hole.
export function describeAnnulusPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
): string {
  const circle = (r: number) =>
    `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
  return `${circle(outerR)} ${circle(innerR)}`
}

// Same idea as describeSlicePath, but for a "donut slice" (annular sector)
// that runs from an inner radius to an outer radius instead of converging
// on a point — used for the ring-style wheel wedges.
export function describeRingSlicePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleDeg: number,
  endAngleDeg: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngleDeg)
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngleDeg)
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngleDeg)
  const innerStart = polarToCartesian(cx, cy, innerR, startAngleDeg)
  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

// The wheel is drawn with segment 0 starting at the top and segments running
// clockwise. A CSS `rotate(deg)` transform on the wheel is also clockwise, so
// the segment now sitting under the fixed top pointer is whichever original
// segment ends up at "angle from top" 0 after subtracting the rotation.
// Four full turns before the wheel is allowed to stop, plus up to one
// more, so a target sitting just ahead doesn't cut the spin short.
const MIN_SPIN_TURNS = 4

/**
 * Which segment the next spin should stop on.
 *
 * Spinning to a random angle and reading off whatever segment it landed on
 * leaves nothing to constrain — "not that one again" cannot be said about a
 * result that does not exist until after the spin has been decided. So the
 * segment is chosen here, first, and the rotation worked out to reach it.
 *
 * Never the film already showing, unless it is the only one on the wheel.
 */
export function pickSegment(
  ids: string[],
  currentId: string | null,
  random: () => number = Math.random,
): number {
  if (ids.length === 0) return -1
  let candidates = ids.map((_, index) => index)
  if (currentId !== null) {
    const elsewhere = candidates.filter((index) => ids[index] !== currentId)
    // One film on the wheel has nowhere else to go.
    if (elsewhere.length > 0) candidates = elsewhere
  }
  return candidates[Math.floor(random() * candidates.length)] ?? candidates[0]
}

/**
 * A rotation that lands the pointer on a chosen segment.
 *
 * Spinning to a random angle and reading off whatever segment it landed on
 * leaves nothing to constrain — "not that one again" cannot be expressed
 * about a result that does not exist until after the spin is decided. So
 * the segment is chosen first and the rotation worked out to reach it.
 */
export function rotationForSegment(
  currentRotation: number,
  index: number,
  segmentCount: number,
  random: () => number = Math.random,
): number {
  if (segmentCount <= 0) return currentRotation
  const segmentAngle = 360 / segmentCount
  // Somewhere inside the segment rather than on its edge, where rounding
  // decides which side of the line the pointer is counted on.
  const angleFromTop = (index + 0.15 + random() * 0.7) * segmentAngle
  const target = ((360 - angleFromTop) % 360 + 360) % 360
  const base = currentRotation + 360 * MIN_SPIN_TURNS
  const baseAngle = ((base % 360) + 360) % 360
  const delta = ((target - baseAngle) % 360 + 360) % 360
  return base + delta + 360 * Math.floor(random() * 2)
}

export function getSegmentIndexAtPointer(rotationDeg: number, segmentCount: number): number {
  if (segmentCount <= 0) return -1
  const segmentAngle = 360 / segmentCount
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360
  const angleFromTopOriginal = (360 - normalizedRotation) % 360
  return Math.floor(angleFromTopOriginal / segmentAngle) % segmentCount
}
