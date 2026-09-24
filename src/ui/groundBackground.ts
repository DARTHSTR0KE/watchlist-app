import type { RGB } from './posterColor'

// Where each wash comes from, in order: top left, top right, upper middle.
const WASH_AT = ['10% 4%', '92% 10%', '50% 30%'] as const

export function groundBackground(tints: readonly RGB[]): string {
  const washes = tints.slice(0, WASH_AT.length).map(([r, g, b], index) => {
    const size = index === 2 ? '85% 50%' : '120% 70%'
    return `radial-gradient(ellipse ${size} at ${WASH_AT[index]}, rgba(${r}, ${g}, ${b}, 0.72), rgba(${r}, ${g}, ${b}, 0) 72%)`
  })
  // Drawn over the washes: clear at the top, near-black by two thirds.
  const fade = 'linear-gradient(180deg, rgba(11, 11, 14, 0) 0%, rgba(11, 11, 14, 0.2) 25%, rgba(11, 11, 14, 0.7) 48%, #0b0b0e 66%)'
  return [fade, ...washes, '#0b0b0e'].join(', ')
}
