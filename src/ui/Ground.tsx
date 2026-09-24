import { useState } from 'react'
import type { RGB } from './posterColor'
import { groundBackground } from './groundBackground'

/**
 * A screen's coloured ground: soft radial washes near the top, fading to
 * near-black by about two thirds of the way down. Never an image, and
 * never more than three washes — past that the colours average to mud.
 *
 * When the washes change it cross-fades rather than cutting, so a ground
 * that is re-drawn several times in a row settles instead of flickering.
 */

interface Layer {
  id: number
  background: string
}

let nextLayer = 1

export function Ground({ tints }: { tints: readonly RGB[] }) {
  const background = groundBackground(tints)
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, background }])
  const [shown, setShown] = useState(background)

  // A new ground goes on top of the old one and fades in; the old one is
  // dropped once it is covered. At most two exist at once.
  if (shown !== background) {
    setShown(background)
    setLayers((current) => [...current.slice(-1), { id: nextLayer++, background }])
  }

  return (
    <div className="ground" aria-hidden="true">
      {layers.map((layer, index) => (
        <div
          key={layer.id}
          className={`ground-layer${index > 0 ? ' ground-layer-in' : ''}`}
          style={{ background: layer.background }}
          onAnimationEnd={() => setLayers((current) => current.slice(-1))}
        />
      ))}
    </div>
  )
}

/**
 * Together: amber from the top left and rust from the right, drifting
 * towards each other and apart again on a nine-second loop.
 */
export function DriftingGround({ left, right }: { left: RGB; right: RGB }) {
  const wash = ([r, g, b]: RGB) =>
    `radial-gradient(circle at center, rgba(${r}, ${g}, ${b}, 0.72), rgba(${r}, ${g}, ${b}, 0) 65%)`
  return (
    <div className="ground ground-drift" aria-hidden="true">
      <div className="ground-drift-wash ground-drift-left" style={{ background: wash(left) }} />
      <div className="ground-drift-wash ground-drift-right" style={{ background: wash(right) }} />
      <div className="ground-drift-fade" />
    </div>
  )
}
