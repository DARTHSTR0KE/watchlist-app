import { describe, expect, it } from 'vitest'
import { dominantColor, vividness } from './posterColor'
import { groundBackground } from './groundBackground'

function pixels(colors: [number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]))
}

describe('dominantColor', () => {
  it('picks the vivid family, not the average of everything', () => {
    // Mostly dark and grey, with a patch of strong blue: the answer is
    // blue, where an average would be a muddy grey-brown.
    const poster = pixels([
      ...Array.from({ length: 40 }, () => [20, 20, 22] as [number, number, number]),
      ...Array.from({ length: 30 }, () => [128, 120, 110] as [number, number, number]),
      ...Array.from({ length: 12 }, () => [30, 70, 200] as [number, number, number]),
    ])
    const [r, g, b] = dominantColor(poster)!
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g)
  })

  it('finds nothing in a black-and-white poster', () => {
    expect(dominantColor(pixels([[0, 0, 0], [255, 255, 255], [120, 120, 120]]))).toBeNull()
  })

  it('lifts what it finds to a colour, not a shade', () => {
    const dim = pixels(Array.from({ length: 10 }, () => [60, 20, 10] as [number, number, number]))
    const found = dominantColor(dim)!
    expect(vividness(found)).toBeGreaterThan(vividness([60, 20, 10]))
  })
})

describe('the ground', () => {
  it('uses at most three washes and always fades to near-black', () => {
    const background = groundBackground([
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 0],
    ])
    expect(background.match(/radial-gradient/g)).toHaveLength(3)
    expect(background).toContain('#0b0b0e 66%')
  })
})
