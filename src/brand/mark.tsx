import { BIN, BOWL, BRAND, GLASS, GOLDFISH, MOON, PARTY_HAT, RACCOON, RACCOON_SEATED, SACK } from './paths'

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

/**
 * The seated raccoon, in named groups. The splash rotates `sp-head` about
 * the neck and `sp-arms` about the shoulders; everything else stays put.
 */
export function RaccoonSeatedShapes() {
  const r = RACCOON_SEATED
  return (
    <g>
      <g className="sp-tail">
        <path d={r.tail} fill={BRAND.fur} />
        {/* Clipped to the tail so the bands stop at its edge instead of
            running across the body behind it. */}
        <clipPath id="sp-tail-clip">
          <path d={r.tail} />
        </clipPath>
        <g clipPath="url(#sp-tail-clip)">
          {r.tailStripes.map((d) => (
            <path key={d} d={d} fill={BRAND.mask} />
          ))}
        </g>
      </g>

      <ellipse
        cx={r.footLeft.cx}
        cy={r.footLeft.cy}
        rx={r.footLeft.rx}
        ry={r.footLeft.ry}
        fill={BRAND.mask}
      />
      <ellipse
        cx={r.footRight.cx}
        cy={r.footRight.cy}
        rx={r.footRight.rx}
        ry={r.footRight.ry}
        fill={BRAND.mask}
      />
      <path d={r.body} fill={BRAND.fur} />

      <g className="sp-arms">
        {/* Dark, like the mask and the feet. Cream arms on a cream body
            left only the paws showing, which read as two buttons on his
            belly rather than as limbs that could pick anything up. */}
        <path
          d={r.armLeft}
          stroke={BRAND.mask}
          strokeWidth={r.armWidth}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={r.armRight}
          stroke={BRAND.mask}
          strokeWidth={r.armWidth}
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* The animated group and the placement group are separate on
          purpose: a CSS transform on an SVG element replaces the transform
          attribute outright, so animating this one would otherwise throw
          the head off the body. */}
      <g className="sp-head">
        <g transform={r.headTransform}>
          <RaccoonShapes />
        </g>
      </g>
    </g>
  )
}

/**
 * The goldfish in its bowl. `swimming` sets it circling, `loop` sends it
 * round once and settles — both are decoration on top of the same still
 * picture, so reduced motion simply omits the class.
 *
 * Ids are suffixed because a page can hold several bowls at once and a
 * duplicated clipPath id would make every bowl use the first one's shape.
 */
export function BowlShapes({
  uid,
  swimming = false,
  loop = false,
  tipped = false,
}: {
  uid: string
  swimming?: boolean
  loop?: boolean
  tipped?: boolean
}) {
  const b = BOWL
  const clip = `bowl-clip-${uid}`
  const fishClass = loop ? 'bowl-fish bowl-fish-loop' : swimming ? 'bowl-fish bowl-fish-swim' : 'bowl-fish'

  return (
    <g className={tipped ? 'bowl bowl-tipped' : 'bowl'}>
      <clipPath id={clip}>
        <path d={b.glass} />
      </clipPath>

      <ellipse cx={b.base.cx} cy={b.base.cy} rx={b.base.rx} ry={b.base.ry} fill={GLASS.rim} />
      <path d={b.glass} fill={GLASS.body} />
      {/* The far side of the rim, seen through the opening. */}
      <ellipse cx={b.mouth.cx} cy={b.mouth.cy} rx={b.mouth.rx} ry={b.mouth.ry} fill={GLASS.body} />

      <g clipPath={`url(#${clip})`}>
        {/* Held level by its own counter-rotation while the bowl moves:
            water that tilts with the glass reads as jelly. */}
        <g className="bowl-water">
          <path d={b.water} fill={GLASS.water} />
          <path d={b.waterLine} stroke={GLASS.waterLine} strokeWidth="2" fill="none" />
        </g>
        <g className={fishClass}>
          <g transform={b.fishTransform}>
            <GoldfishShapes />
          </g>
        </g>
      </g>

      <path d={b.glass} fill="none" stroke={GLASS.rim} strokeWidth="3" />
      {/* Thin, and over everything: this is the lip you would put a hand
          over to carry it. */}
      <ellipse
        cx={b.mouth.cx}
        cy={b.mouth.cy}
        rx={b.mouth.rx}
        ry={b.mouth.ry}
        fill="none"
        stroke={GLASS.rim}
        strokeWidth="2.5"
      />
    </g>
  )
}

// The haul, filling as the count climbs. `filled` is 0-10.
export function SackShapes({ filled }: { filled: number }) {
  const s = SACK
  return (
    <g>
      {/* Sackcloth rather than shadow: the mask colour on this ground was
          a hole in the screen. */}
      <path d={s.body} fill={BRAND.sand} />
      <path d={s.neck} fill={BRAND.sand} />
      <path d={s.tie} fill={BRAND.mask} />
      {s.loot.slice(0, Math.max(0, Math.min(s.loot.length, filled))).map((piece) => (
        <circle key={`${piece.cx}-${piece.cy}`} cx={piece.cx} cy={piece.cy} r={piece.r} fill={BRAND.mask} />
      ))}
    </g>
  )
}

// Head-first in it, which is the whole joke.
export function BinShapes() {
  const b = BIN
  return (
    <g>
      {/* Legs in fur, not mask: dark legs against a dark bin read as
          nothing sticking out at all. */}
      <path d={b.legLeft} stroke={BRAND.fur} strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d={b.legRight} stroke={BRAND.fur} strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d={b.tail} stroke={BRAND.fur} strokeWidth="11" strokeLinecap="round" fill="none" />
      <path d={b.body} fill={BRAND.slate} opacity="0.75" />
      <path d={b.lid} fill={BRAND.slate} />
      {b.ribs.map((d) => (
        <path key={d} d={d} stroke={BRAND.mask} strokeWidth="2.5" fill="none" opacity="0.5" />
      ))}
    </g>
  )
}

export function MoonShapes() {
  return <path d={MOON.crescent} fill={BRAND.sand} />
}

// Only ever rendered on 30 September.
export function PartyHat() {
  const h = PARTY_HAT
  return (
    <g>
      <path d={h.cone} fill={BRAND.rust} />
      <path d={h.band} fill={BRAND.amber} />
      <circle cx={h.pom.cx} cy={h.pom.cy} r={h.pom.r} fill={BRAND.amber} />
    </g>
  )
}
