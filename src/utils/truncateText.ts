let measureCanvas: HTMLCanvasElement | null = null

function getMeasureContext(font: string): CanvasRenderingContext2D {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.font = font
  return ctx
}

// Trims text to fit maxWidth (px) at the given CSS font, appending an
// ellipsis. Used to keep wheel segment labels from overflowing their slice.
export function truncateToWidth(text: string, maxWidth: number, font: string): string {
  const ctx = getMeasureContext(font)
  if (ctx.measureText(text).width <= maxWidth) return text

  const ellipsis = '…'
  let lo = 0
  let hi = text.length

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = text.slice(0, mid) + ellipsis
    if (ctx.measureText(candidate).width <= maxWidth) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }

  return lo === 0 ? ellipsis : text.slice(0, lo) + ellipsis
}
