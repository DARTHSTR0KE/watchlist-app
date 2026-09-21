/**
 * The pair, as flat vector paths — one source for the launcher icon, the
 * splash and the empty states, so the three can never drift apart.
 *
 * Deliberately few shapes and high contrast: the icon has to read at 48
 * pixels, which is the size Android actually draws on a home screen.
 */

export const BRAND = {
  ground: '#121218',
  fur: '#EDE7DA',
  mask: '#2B2932',
  fish: '#E2743A',
  fin: '#B84A1E',
  // Literals rather than CSS variables because the icon is rasterized
  // through a canvas, where a var() resolves to nothing. Same values as
  // the palette in theme.css.
  amber: '#d9a441',
  rust: '#b0705f',
  slate: '#6e7ba6',
  sand: '#c2a878',
} as const

// Front-facing raccoon on a 100x100 grid, ears from y=10.
export const RACCOON = {
  viewBox: '0 0 100 100',
  // Rounded, not pointed. Sharp triangles read as a cat at icon size.
  earOuterLeft: 'M19 45 C11 31 11 16 23 14 C34 17 41 27 45 34 Z',
  earOuterRight: 'M81 45 C89 31 89 16 77 14 C66 17 59 27 55 34 Z',
  earInnerLeft: 'M26 38 C21 29 21 22 27 21 C33 23 37 29 39 33 Z',
  earInnerRight: 'M74 38 C79 29 79 22 73 21 C67 23 63 29 61 33 Z',
  head: { cx: 50, cy: 57, rx: 35, ry: 31 },
  // Two patches with a bridge between them: the classic bandit mask, in
  // three primitives rather than one clever path.
  maskLeft: { cx: 35, cy: 51, rx: 16, ry: 10.5, rotate: -12 },
  maskRight: { cx: 65, cy: 51, rx: 16, ry: 10.5, rotate: 12 },
  maskBridge: { x: 43, y: 47, width: 14, height: 9 },
  eyeLeft: { cx: 34, cy: 51, r: 4.6 },
  eyeRight: { cx: 66, cy: 51, r: 4.6 },
  // Small and clear of the mask: at 48px two dark shapes this close merge
  // into one blob and the face stops being a face.
  snout: 'M50 69 Q56 69 55 74 Q54 79 50 81 Q46 79 45 74 Q44 69 50 69 Z',
} as const

// Goldfish on a 100x64 grid, facing right.
export const GOLDFISH = {
  viewBox: '0 0 100 64',
  body: 'M24 34 Q36 12 60 12 Q86 14 93 34 Q86 54 60 56 Q36 56 24 34 Z',
  tail: 'M30 34 L5 16 Q13 34 5 52 Z',
  dorsal: 'M46 15 Q54 4 65 14 Q56 10 46 15 Z',
  pelvic: 'M44 52 Q50 63 61 51 Q52 56 44 52 Z',
  eye: { cx: 78, cy: 29, r: 4.2 },
} as const

/**
 * The seated raccoon, full-bodied, on a 120x140 grid. Only the splash uses
 * this — at 34px an empty-state drawing needs to be a head and nothing
 * else, and the launcher icon the same.
 *
 * Parts are kept apart rather than merged into one silhouette because he
 * has to turn, reach and carry: a single path can't do any of that.
 */
export const RACCOON_SEATED = {
  viewBox: '0 0 120 140',
  // Curls out to his left and up, so the stripes read against the ground.
  tail: 'M44 112 C14 116 0 88 13 65 C18 55 32 53 38 62 C25 74 23 94 35 103 Z',
  tailStripes: [
    'M2 94 L42 80 L47 94 L7 108 Z',
    'M0 74 L36 60 L41 73 L5 87 Z',
    'M4 56 L32 46 L37 58 L9 68 Z',
  ],
  body: 'M60 56 C83 56 93 78 93 99 C93 121 79 132 60 132 C41 132 27 121 27 99 C27 78 37 56 60 56 Z',
  footLeft: { cx: 44, cy: 128, rx: 12.5, ry: 7 },
  footRight: { cx: 76, cy: 128, rx: 12.5, ry: 7 },
  // Drawn as thick round-capped strokes: one line each, which is what
  // makes a reach a rotation rather than a redraw.
  armLeft: 'M47 78 L34 103',
  armRight: 'M73 78 L86 103',
  armWidth: 13,
  pawLeft: { cx: 43, cy: 105, r: 7 },
  pawRight: { cx: 77, cy: 105, r: 7 },
  // Where the head-only drawing sits on this body, and the pivots the
  // splash rotates around.
  headTransform: 'translate(24 -1) scale(0.72)',
  neck: { x: 60, y: 62 },
  shoulder: { x: 60, y: 78 },
} as const

// Glass reads as a pale wash over the dark ground rather than a colour of
// its own — the palette has no glass in it, and adding one would put a
// seventh colour into a five-colour brand.
export const GLASS = {
  body: 'rgba(237, 231, 218, 0.14)',
  rim: 'rgba(237, 231, 218, 0.38)',
  water: 'rgba(110, 123, 166, 0.42)',
  waterLine: 'rgba(237, 231, 218, 0.30)',
} as const

/**
 * The bowl, on a 100x100 grid with the fish swimming inside it. A round
 * bowl with a flat base and a water line across it — the fish is drawn
 * between the water and the glass so it reads as being in it.
 */
export const BOWL = {
  viewBox: '0 0 100 100',
  glass: 'M50 12 C74 12 92 32 92 56 C92 78 74 92 50 92 C26 92 8 78 8 56 C8 32 26 12 50 12 Z',
  /**
   * Filled to just under the rim and clipped to the glass. Drawn far
   * wider and deeper than the bowl on purpose: the water counter-rotates
   * to stay level while the glass tilts, and a rect that only just covered
   * the glass would swing a corner off it and leave the bottom dry.
   */
  water: 'M-120 34 L220 34 L220 320 L-120 320 Z',
  waterLine: 'M-120 34 L220 34',
  base: { cx: 50, cy: 92, rx: 22, ry: 5 },
  // Where the fish sits, and the circle it swims when it loops.
  fishTransform: 'translate(18 44) scale(0.64)',
} as const

// The sack: a bandit's haul, filling up as the count climbs.
export const SACK = {
  viewBox: '0 0 100 100',
  body: 'M22 44 C22 34 34 30 50 30 C66 30 78 34 78 44 C82 64 80 88 50 88 C20 88 18 64 22 44 Z',
  neck: 'M36 32 C40 22 60 22 64 32 C58 28 42 28 36 32 Z',
  tie: 'M34 34 L66 34 L64 40 L36 40 Z',
  // Ten notches, revealed in order as the pile grows.
  loot: [
    { cx: 38, cy: 74, r: 5 },
    { cx: 52, cy: 76, r: 5 },
    { cx: 65, cy: 73, r: 5 },
    { cx: 33, cy: 64, r: 5 },
    { cx: 47, cy: 66, r: 5 },
    { cx: 61, cy: 64, r: 5 },
    { cx: 40, cy: 55, r: 5 },
    { cx: 54, cy: 56, r: 5 },
    { cx: 66, cy: 54, r: 5 },
    { cx: 47, cy: 45, r: 5 },
  ],
} as const

// The bin, with a raccoon head-first in it.
export const BIN = {
  viewBox: '0 0 120 100',
  body: 'M24 34 L96 34 L88 94 L32 94 Z',
  lid: 'M18 26 L102 26 L102 36 L18 36 Z',
  ribs: ['M40 40 L36 88', 'M60 40 L60 88', 'M80 40 L84 88'],
  // Hind legs and tail sticking out of the top.
  legLeft: 'M46 32 L34 2',
  legRight: 'M72 32 L86 4',
  tail: 'M58 30 C50 6 74 -4 92 8',
} as const

export const MOON = {
  viewBox: '0 0 100 100',
  // A crescent as one path: a disc with a bite out of it.
  crescent: 'M62 8 A44 44 0 1 0 62 92 A36 36 0 1 1 62 8 Z',
} as const

// Worn on 30 September, and only then.
export const PARTY_HAT = {
  cone: 'M50 2 L68 40 L32 40 Z',
  pom: { cx: 50, cy: 3, r: 6 },
  band: 'M34 36 L66 36 L68 40 L32 40 Z',
} as const
