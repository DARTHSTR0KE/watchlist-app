import { useEffect, useRef, useState } from 'react'
import { buildPageBackdropUrl } from './posters'

interface FilmBackdropProps {
  backdropPath: string | null
}

interface BackdropState {
  slots: [string | null, string | null]
  active: 0 | 1
}

// Two stacked layers that cross-fade. The incoming image is fully decoded
// before the swap, so the fade never runs against a half-loaded image — and
// a film with no backdrop fades out to the flat page background rather than
// stranding the previous film's image on screen.
export function FilmBackdrop({ backdropPath }: FilmBackdropProps) {
  const targetUrl = buildPageBackdropUrl(backdropPath)
  const [state, setState] = useState<BackdropState>({ slots: [null, null], active: 0 })
  const shownUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (targetUrl === shownUrlRef.current) return

    const commit = () => {
      shownUrlRef.current = targetUrl
      setState((previous) => {
        const next: 0 | 1 = previous.active === 0 ? 1 : 0
        const slots: [string | null, string | null] = [previous.slots[0], previous.slots[1]]
        slots[next] = targetUrl
        return { slots, active: next }
      })
    }

    if (!targetUrl) {
      commit()
      return
    }

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (!cancelled) commit()
    }
    image.onerror = () => {
      // Leave whatever is on screen rather than flashing to empty.
    }
    image.src = targetUrl

    return () => {
      cancelled = true
    }
  }, [targetUrl])

  return (
    <div className="film-backdrop" aria-hidden="true">
      {state.slots.map((url, index) => (
        <div
          key={index}
          className="film-backdrop-layer"
          style={{
            backgroundImage: url ? `url("${url}")` : undefined,
            opacity: url && index === state.active ? 1 : 0,
          }}
        />
      ))}
      <div className="film-backdrop-scrim" />
    </div>
  )
}
