import { useEffect, useState } from 'react'
import type { WheelItem } from './titles'
import { buildPosterUrl } from './posters'

export type ImageStatus = 'loading' | 'loaded' | 'error'

interface PosterPreloadState {
  statuses: Record<string, ImageStatus>
  allSettled: boolean
}

// Preloads every poster up front so a spin never starts mid-load. An item
// with no poster path (or one that fails to load) is marked 'error', which
// the wheel treats as "fall back to a flat colour" for that segment.
export function usePosterImages(items: WheelItem[]): PosterPreloadState {
  const [statuses, setStatuses] = useState<Record<string, ImageStatus>>({})

  useEffect(() => {
    let cancelled = false
    const images: HTMLImageElement[] = []

    for (const item of items) {
      const url = buildPosterUrl(item.posterPath)
      if (!url) {
        // No poster for this title — settle it as 'error' so the wheel
        // falls back to a flat colour instead of blocking every spin.
        queueMicrotask(() => {
          if (!cancelled) setStatuses((prev) => ({ ...prev, [item.id]: 'error' }))
        })
        continue
      }

      const img = new Image()
      img.onload = () => {
        if (!cancelled) setStatuses((prev) => ({ ...prev, [item.id]: 'loaded' }))
      }
      img.onerror = () => {
        if (!cancelled) setStatuses((prev) => ({ ...prev, [item.id]: 'error' }))
      }
      img.src = url
      images.push(img)
    }

    return () => {
      cancelled = true
      for (const img of images) {
        img.onload = null
        img.onerror = null
      }
    }
  }, [items])

  const allSettled = items.every((item) => {
    const status = statuses[item.id]
    return status === 'loaded' || status === 'error'
  })

  return { statuses, allSettled }
}
