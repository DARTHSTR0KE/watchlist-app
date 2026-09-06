import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SpinWheel } from './wheel/SpinWheel'
import { ResultModal } from './wheel/ResultModal'
import { INITIAL_TITLES } from './wheel/titles'
import type { WheelItem } from './wheel/titles'
import { getSegmentIndexAtPointer } from './wheel/wheelMath'
import { usePosterImages } from './wheel/usePosterImages'

const MAX_REROLLS = 2
const SPIN_DURATION_MS = 4000
const VIBRATE_PATTERN = [40, 30, 80]

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return reduced
}

function App() {
  const [items, setItems] = useState<WheelItem[]>(INITIAL_TITLES)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<WheelItem | null>(null)
  const [rerollsUsed, setRerollsUsed] = useState(0)
  const reduceMotion = usePrefersReducedMotion()
  // Preloaded against the fixed master list, not the mutable `items` state,
  // so removing a title later never re-triggers a loading gate.
  const { statuses: imageStatuses, allSettled: postersReady } = usePosterImages(INITIAL_TITLES)

  const pendingResultRef = useRef<WheelItem | null>(null)
  const fallbackTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(fallbackTimerRef.current), [])

  const finishSpin = useCallback(() => {
    if (pendingResultRef.current === null) return
    window.clearTimeout(fallbackTimerRef.current)
    setSpinning(false)
    setResult(pendingResultRef.current)
    pendingResultRef.current = null
    navigator.vibrate?.(VIBRATE_PATTERN)
  }, [])

  const spin = useCallback(
    (isReroll: boolean) => {
      if (spinning || items.length === 0 || !postersReady) return
      if (isReroll && rerollsUsed >= MAX_REROLLS) return

      const extraSpins = 4 + Math.random() * 2 // 4-6 full rotations
      const nextRotation = rotation + 360 * extraSpins
      const index = getSegmentIndexAtPointer(nextRotation, items.length)
      pendingResultRef.current = items[index] ?? null

      setResult(null)
      setSpinning(true)
      setRerollsUsed((used) => (isReroll ? used + 1 : 0))
      setRotation(nextRotation)

      window.clearTimeout(fallbackTimerRef.current)
      if (reduceMotion) {
        fallbackTimerRef.current = window.setTimeout(finishSpin, 0)
      } else {
        fallbackTimerRef.current = window.setTimeout(finishSpin, SPIN_DURATION_MS + 150)
      }
    },
    [spinning, items, rerollsUsed, rotation, reduceMotion, finishSpin, postersReady],
  )

  // Shared by "Watch this" and dismissing the modal (tap-outside or swipe
  // down) — both just return to an idle wheel ready for a fresh cycle.
  // Dismissing never touches rerollsUsed, so it never consumes a reroll.
  const resetToIdle = () => {
    setResult(null)
    setRerollsUsed(0)
  }

  const handleWatchThis = resetToIdle
  const handleDismiss = resetToIdle

  const handleTakeOff = () => {
    setItems((current) => current.filter((item) => item.id !== result?.id))
    setResult(null)
    setRerollsUsed(0)
  }

  const rerollsRemaining = MAX_REROLLS - rerollsUsed

  return (
    <div className="app">
      <h1 className="app-title">Spin the Watchlist</h1>

      <SpinWheel
        items={items}
        rotation={rotation}
        reduceMotion={reduceMotion}
        imageStatuses={imageStatuses}
        onSpinEnd={finishSpin}
      />

      {items.length === 0 ? (
        <p className="empty-state">No titles left on the wheel.</p>
      ) : (
        <button
          className="spin-button"
          type="button"
          onClick={() => spin(false)}
          disabled={spinning || !postersReady || result !== null}
        >
          {!postersReady ? 'Loading posters…' : spinning ? 'Spinning…' : 'Spin'}
        </button>
      )}

      {result && (
        <ResultModal
          item={result}
          rerollsRemaining={rerollsRemaining}
          canReroll={rerollsRemaining > 0}
          reduceMotion={reduceMotion}
          onWatch={handleWatchThis}
          onSpinAgain={() => spin(true)}
          onTakeOff={handleTakeOff}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  )
}

export default App
