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
