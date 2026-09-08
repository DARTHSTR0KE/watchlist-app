import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SpinWheel } from './wheel/SpinWheel'
import { ResultModal } from './wheel/ResultModal'
import type { WheelItem } from './wheel/titles'
import { getSegmentIndexAtPointer } from './wheel/wheelMath'
import { usePosterImages } from './wheel/usePosterImages'
import { loadWheelItems } from './wheel/loadWheelItems'
import { ensureAudioContext, playTick, useMuted } from './wheel/tickSound'
import { FilmBackdrop } from './wheel/FilmBackdrop'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { SignInScreen } from './auth/SignInScreen'
import { Header } from './auth/Header'
import { EnrichmentProvider } from './import/EnrichmentContext'
import { ImportScreen } from './import/ImportScreen'
import { hasWatchlistItems, undoWatchFilm, watchFilmNow } from './import/watchlistWrites'
import type { WatchUndoSnapshot } from './import/watchlistWrites'
import { Footer } from './Footer'

const MAX_REROLLS = 2
const SPIN_DURATION_MS = 4000
const VIBRATE_PATTERN = [40, 30, 80]
const MIN_WHEEL_SEGMENTS = 2
const UNDO_WINDOW_MS = 8000

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

function WheelScreen() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''

  const [masterItems, setMasterItems] = useState<WheelItem[]>([])
  const [items, setItems] = useState<WheelItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<WheelItem | null>(null)
  const [rerollsUsed, setRerollsUsed] = useState(0)
  const [undo, setUndo] = useState<{
    snapshot: WatchUndoSnapshot
    title: string
    item: WheelItem
  } | null>(null)
  const undoTimerRef = useRef<number | undefined>(undefined)
  const reduceMotion = usePrefersReducedMotion()
  const [muted, toggleMuted] = useMuted()

  useEffect(() => {
    let cancelled = false
    loadWheelItems(userId).then((loaded) => {
      if (cancelled) return
      setMasterItems(loaded)
      setItems(loaded)
      setLoadingItems(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Preloaded against the fixed master list, not the mutable `items` state,
  // so removing a title later never re-triggers a loading gate.
  const { statuses: imageStatuses, allSettled: postersReady } = usePosterImages(masterItems)

  const pendingResultRef = useRef<WheelItem | null>(null)
  const fallbackTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(fallbackTimerRef.current), [])
  useEffect(() => () => window.clearTimeout(undoTimerRef.current), [])

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
      // Every spin routes through here — the hub and "Spin again" alike — so
      // this is the one place that reliably sits inside the starting tap.
      void ensureAudioContext()

      if (spinning || items.length === 0 || !postersReady) return
      if (isReroll && rerollsUsed >= MAX_REROLLS) return

      const extraSpins = 4 + Math.random() * 2 // 4-6 full rotations
      const nextRotation = rotation + 360 * extraSpins
      const index = getSegmentIndexAtPointer(nextRotation, items.length)
      pendingResultRef.current = items[index] ?? null

      setResult(null)
      setSpinning(true)
      // A plain spin never touches the reroll budget — only a reroll spends
      // it, and only "Watch this" resets it. This is the sole reset trigger
      // (see handleWatchThis below); spin() deciding the budget here, on
      // every non-reroll call, was the bug.
      if (isReroll) setRerollsUsed((used) => used + 1)
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

  // The only reset trigger: committing to a film ends the round, so the
  // next one starts with a fresh budget.
  // Committing to a film takes it off this user's watchlist and records it
  // as watched today. Only ever touches this user's own rows — a partner
  // logs their own watch. The film drops off the wheel immediately; it
  // stays in masterItems so its poster stays preloaded for an undo.
  const handleWatchThis = () => {
    const watched = result
    setResult(null)
    setRerollsUsed(0)
    if (!watched) return

    setItems((current) => current.filter((item) => item.id !== watched.id))

    void watchFilmNow(userId, watched.id)
      .then((snapshot) => {
        window.clearTimeout(undoTimerRef.current)
        setUndo({ snapshot, title: watched.title, item: watched })
        undoTimerRef.current = window.setTimeout(() => setUndo(null), UNDO_WINDOW_MS)
      })
      .catch(() => {
        // The write failed, so put it back rather than showing a wheel that
        // disagrees with the database.
        setItems((current) =>
          current.some((item) => item.id === watched.id) ? current : [...current, watched],
        )
      })
  }

  const handleUndoWatch = () => {
    const pending = undo
    if (!pending) return
    window.clearTimeout(undoTimerRef.current)
    setUndo(null)
    setItems((current) =>
      current.some((item) => item.id === pending.item.id) ? current : [...current, pending.item],
    )
    void undoWatchFilm(userId, pending.snapshot).catch(() => {
      setItems((current) => current.filter((item) => item.id !== pending.item.id))
    })
  }

  // Dismissing (tap-outside or swipe down) just returns to idle — it
  // doesn't commit to anything, so it neither spends nor resets the budget.
  const handleDismiss = () => {
    setResult(null)
  }

  // Session-only: removals live in React state alone and reset on reload.
  // The wheel shrinks by one segment rather than backfilling a replacement,
  // and never drops below MIN_WHEEL_SEGMENTS — below that the result modal
  // offers "Reshuffle" instead. This has its own limit (the floor) and is a
  // separate mechanic from rerolls, so it must never touch rerollsUsed —
  // spending or resetting the reroll budget here was the bug.
  const handleTakeOff = () => {
    const removedId = result?.id
    setItems((current) =>
      current.length > MIN_WHEEL_SEGMENTS ? current.filter((item) => item.id !== removedId) : current,
    )
    setResult(null)
  }

  // Unmuting plays one tick straight away, so the sound can be confirmed
  // without spinning. Awaits the context so it isn't lost to a pending
  // resume on the very first interaction of a session.
  const handleToggleMute = () => {
    const wasMuted = muted
    toggleMuted()
    if (wasMuted) {
      void ensureAudioContext().then(playTick)
    }
  }

  // Restores the full pool at the floor — doesn't spend or reset the
  // reroll budget either, same as Not today.
  const handleReshuffle = () => {
    setItems(masterItems)
    setResult(null)
  }

  const rerollsRemaining = MAX_REROLLS - rerollsUsed
  const canRemoveFromWheel = items.length > MIN_WHEEL_SEGMENTS
  const spinDisabled = spinning || !postersReady || result !== null || items.length === 0

  // The page backdrop follows whichever film the pointer is resting on —
  // derived from rotation, so it also follows along when a removal reshapes
  // the wheel underneath a stationary pointer. It's held while spinning:
  // rotation jumps to its target the moment a spin starts, and cross-fading
  // a full-screen image at every peg would stutter.
  const pointerItem = items[getSegmentIndexAtPointer(rotation, items.length)] ?? null
  const pointerBackdrop = pointerItem?.backdropPath ?? null
  const [displayedBackdrop, setDisplayedBackdrop] = useState<string | null>(pointerBackdrop)
  if (!spinning && displayedBackdrop !== pointerBackdrop) {
    setDisplayedBackdrop(pointerBackdrop)
  }

  if (loadingItems) return null

  return (
    <div className="app">
      <FilmBackdrop backdropPath={displayedBackdrop} />
      <h1 className="app-title">Spin the Watchlist</h1>

      <SpinWheel
        items={items}
        rotation={rotation}
        reduceMotion={reduceMotion}
        imageStatuses={imageStatuses}
        onSpinEnd={finishSpin}
        onSpin={() => spin(false)}
        spinDisabled={spinDisabled}
      />

      {items.length === 0 ? (
        <p className="empty-state">No titles left on the wheel.</p>
      ) : (
        <div className="wheel-footer-row">
          <p className="wheel-remaining-count">
            {items.length} title{items.length === 1 ? '' : 's'} on the wheel
          </p>
          <button type="button" className="mute-toggle" onClick={handleToggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      )}

      {undo && (
        <div className="undo-banner" role="status">
          <span className="undo-banner-text">Marked "{undo.title}" watched</span>
          <button type="button" className="undo-banner-action" onClick={handleUndoWatch}>
            Undo
          </button>
        </div>
      )}

      {result && (
        <ResultModal
          item={result}
          rerollsRemaining={rerollsRemaining}
          canReroll={rerollsRemaining > 0}
          canRemoveFromWheel={canRemoveFromWheel}
          reduceMotion={reduceMotion}
          onWatch={handleWatchThis}
          onSpinAgain={() => spin(true)}
          onTakeOff={handleTakeOff}
          onReshuffle={handleReshuffle}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  )
}

function AuthenticatedApp() {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const [screen, setScreen] = useState<'wheel' | 'import'>('wheel')
  const [checkingWatchlist, setCheckingWatchlist] = useState(true)

  useEffect(() => {
    let cancelled = false
    hasWatchlistItems(userId).then((has) => {
      if (cancelled) return
      if (!has) setScreen('import')
      setCheckingWatchlist(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (checkingWatchlist) return null

  return (
    <EnrichmentProvider>
      <div className="app-shell">
        <Header screen={screen} onToggleScreen={() => setScreen((s) => (s === 'wheel' ? 'import' : 'wheel'))} />
        {screen === 'wheel' ? <WheelScreen /> : <ImportScreen onGoToWheel={() => setScreen('wheel')} />}
        <Footer />
      </div>
    </EnrichmentProvider>
  )
}

function Gate() {
  const { session, loading } = useAuth()

  // Still restoring the persisted session — show nothing rather than
  // flashing the sign-in screen.
  if (loading) return null

  if (!session) return <SignInScreen />

  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default App
