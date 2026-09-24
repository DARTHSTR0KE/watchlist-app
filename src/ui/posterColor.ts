import { useEffect, useState } from 'react'

/**
 * One colour out of a poster, for a screen's ground. Not the average —
 * averaging a poster, let alone twenty, gives brown — but the most vivid
 * family of hues in it, lifted to a colour that can glow on near-black.
 */

export type RGB = readonly [number, number, number]

// The palette, for grounds that aren't taken from a poster and as the
// stand-in whenever one can't be read.
export const TINT = {
  amber: [217, 164, 65],
  rust: [176, 112, 95],
  sage: [123, 158, 135],
  slate: [110, 123, 166],
  sand: [194, 168, 120],
  mauve: [142, 107, 142],
} as const satisfies Record<string, RGB>

function toHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h * 60, s, l]
}

function toRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

const HUE_BINS = 12

/**
 * From raw RGBA pixels: bin by hue, weighting each pixel by how saturated
 * and how bright it is, take the heaviest bin, average only that bin, and
 * lift the result so it reads as a colour rather than a shade. Null when
 * there is nothing coloured at all — a black-and-white poster.
 */
export function dominantColor(pixels: Uint8ClampedArray): RGB | null {
  const weight = new Array<number>(HUE_BINS).fill(0)
  const sums = Array.from({ length: HUE_BINS }, () => [0, 0, 0])
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const rgb: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]]
    const [h, s, l] = toHsl(rgb)
    // Near-black, near-white and grey carry no colour worth keeping.
    if (s < 0.2 || l < 0.12 || l > 0.9) continue
    const w = s * (1 - Math.abs(l - 0.5) * 1.6)
    if (w <= 0) continue
    const bin = Math.floor(h / (360 / HUE_BINS)) % HUE_BINS
    weight[bin] += w
    sums[bin][0] += rgb[0] * w
    sums[bin][1] += rgb[1] * w
    sums[bin][2] += rgb[2] * w
  }
  let best = -1
  for (let bin = 0; bin < HUE_BINS; bin += 1) {
    if (weight[bin] > 0 && (best === -1 || weight[bin] > weight[best])) best = bin
  }
  if (best === -1) return null
  const mean: RGB = [
    sums[best][0] / weight[best],
    sums[best][1] / weight[best],
    sums[best][2] / weight[best],
  ]
  const [h, s, l] = toHsl(mean)
  return toRgb(h, Math.max(s, 0.45), Math.min(Math.max(l, 0.4), 0.56))
}

// How vivid a colour is, for choosing a few out of many.
export function vividness(rgb: RGB): number {
  const [, s, l] = toHsl(rgb)
  return s * (1 - Math.abs(l - 0.5))
}

// The smallest size TMDB offers: a colour needs a few hundred pixels, not
// a poster.
const SAMPLE_BASE = 'https://image.tmdb.org/t/p/w92'
const cache = new Map<string, Promise<RGB | null>>()

/**
 * Null whenever the poster can't be read — missing, offline, or the image
 * server not allowing a cross-origin read, which leaves the canvas tainted.
 * The caller then falls back to the screen's own tint.
 */
export function posterColor(posterPath: string | null | undefined): Promise<RGB | null> {
  if (!posterPath) return Promise.resolve(null)
  const existing = cache.get(posterPath)
  if (existing) return existing
  const pending = new Promise<RGB | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 24
        canvas.height = 36
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return resolve(null)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(dominantColor(context.getImageData(0, 0, canvas.width, canvas.height).data))
      } catch {
        resolve(null)
      }
    }
    image.onerror = () => resolve(null)
    image.src = `${SAMPLE_BASE}${posterPath}`
  })
  cache.set(posterPath, pending)
  return pending
}

/**
 * The colours of these posters, in order, skipping any that couldn't be
 * read. Null until the first answer is in, so a screen can hold its
 * fallback rather than flash a wrong colour.
 */
export function usePosterColors(posterPaths: (string | null | undefined)[]): RGB[] | null {
  const key = posterPaths.map((path) => path ?? '').join('|')
  const [resolved, setResolved] = useState<{ key: string; colors: RGB[] } | null>(null)
  useEffect(() => {
    let cancelled = false
    const paths = key.split('|').filter(Boolean)
    if (paths.length === 0) return
    void Promise.all(paths.map(posterColor)).then((colors) => {
      if (!cancelled) {
        setResolved({ key, colors: colors.filter((color): color is RGB => color !== null) })
      }
    })
    return () => {
      cancelled = true
    }
  }, [key])
  if (key.split('|').filter(Boolean).length === 0) return []
  return resolved?.key === key ? resolved.colors : null
}
