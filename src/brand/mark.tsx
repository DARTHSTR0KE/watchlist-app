import { BRAND, GOLDFISH, RACCOON } from './paths'

/**
 * The two of them, drawn from the shared path data. Both are plain <g>
 * groups on their own grid so a caller can place and scale them freely —
 * the icon, the splash and the empty states all do it differently.
 */

export function RaccoonShapes() {
  const r = RACCOON
  return (
    <g>
      <path d={r.earOuterLeft} fill={BRAND.fur} strokeLinejoin="round" />
      <path d={r.earOuterRight} fill={BRAND.fur} strokeLinejoin="round" />
      <path d={r.earInnerLeft} fill={BRAND.mask} />
      <path d={r.earInnerRight} fill={BRAND.mask} />
      <ellipse cx={r.head.cx} cy={r.head.cy} rx={r.head.rx} ry={r.head.ry} fill={BRAND.fur} />
      <ellipse
        cx={r.maskLeft.cx}
        cy={r.maskLeft.cy}
        rx={r.maskLeft.rx}
        ry={r.maskLeft.ry}
        fill={BRAND.mask}
        transform={`rotate(${r.maskLeft.rotate} ${r.maskLeft.cx} ${r.maskLeft.cy})`}
      />
      <ellipse
        cx={r.maskRight.cx}
        cy={r.maskRight.cy}
        rx={r.maskRight.rx}
        ry={r.maskRight.ry}
        fill={BRAND.mask}
        transform={`rotate(${r.maskRight.rotate} ${r.maskRight.cx} ${r.maskRight.cy})`}
      />
      <rect
        x={r.maskBridge.x}
        y={r.maskBridge.y}
        width={r.maskBridge.width}
        height={r.maskBridge.height}
        fill={BRAND.mask}
      />
      <circle cx={r.eyeLeft.cx} cy={r.eyeLeft.cy} r={r.eyeLeft.r} fill={BRAND.fur} />
      <circle cx={r.eyeRight.cx} cy={r.eyeRight.cy} r={r.eyeRight.r} fill={BRAND.fur} />
      <path d={r.snout} fill={BRAND.mask} />
    </g>
  )
}

export function GoldfishShapes() {
  const g = GOLDFISH
  return (
    <g>
      {/* Tail and fins first, so the body sits over where they join. */}
      <path d={g.tail} fill={BRAND.fin} />
      <path d={g.dorsal} fill={BRAND.fin} />
      <path d={g.pelvic} fill={BRAND.fin} />
      <path d={g.body} fill={BRAND.fish} />
      <circle cx={g.eye.cx} cy={g.eye.cy} r={g.eye.r} fill={BRAND.mask} />
    </g>
  )
}

// Standalone, for anywhere that wants just one of them at a given size.
export function Raccoon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={RACCOON.viewBox} className={className} aria-hidden="true">
      <RaccoonShapes />
    </svg>
  )
}

export function Goldfish({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.64}
      viewBox={GOLDFISH.viewBox}
      className={className}
      aria-hidden="true"
    >
      <GoldfishShapes />
    </svg>
  )
}
