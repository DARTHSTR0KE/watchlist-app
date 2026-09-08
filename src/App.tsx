import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SpinWheel } from './wheel/SpinWheel'
import { ResultModal } from './wheel/ResultModal'
import type { WheelItem } from './wheel/titles'
import { getSegmentIndexAtPointer } from './wheel/wheelMath'
import { usePosterImages } from './wheel/usePosterImages'
import { loadWatchedFilmIds, loadWheelItems } from './wheel/loadWheelItems'
import { FilterSheet } from './wheel/FilterSheet'
import { DEFAULT_FILTERS, applyFilters, mostRestrictiveFilter } from './wheel/filters'
import type { WheelFilters } from './wheel/filters'
import { WHEEL_DRAW_SIZE, weightedSample } from './wheel/weightedDraw'
import { loadPresets, recordSpin, recordSpinOutcome, savePreset } from './wheel/wheelPersistence'
import type { FilterPreset, SpinOutcome } from './wheel/wheelPersistence'
import { ensureAudioContext, playTick, useMuted } from './wheel/tickSound'
import { FilmBackdrop } from './wheel/FilmBackdrop'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { SignInScreen } from './auth/SignInScreen'
import { Header } from './auth/Header'
import { EnrichmentProvider } from './import/EnrichmentContext'
import { ImportScreen } from './import/ImportScreen'
import {
  hasWatchedItems,
  hasWatchlistItems,
  undoWatchFilm,
  watchFilmNow,
} from './import/watchlistWrites'
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
  const [hasWatchedEver, setHasWatchedEver] = useState(false)
  // Films watched in this session. Tracked so the empty state can say why
  // the wheel is bare, and so Reshuffle doesn't resurrect them.
  const [watchedThisSession, setWatchedThisSession] = useState<Set<string>>(new Set())
  // Set aside with "Not tonight": excluded for the session, and stays
  // excluded when the wheel is redrawn.
  const [setAside, setSetAside] = useState<Set<string>>(new Set())
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<WheelFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const spinIdRef = useRef<string | null>(null)
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
    Promise.all([
      loadWheelItems(userId),
      loadWatchedFilmIds(userId).catch(() => new Set<string>()),
      loadPresets(userId).catch(() => [] as FilterPreset[]),
    ]).then(async ([loaded, watched, savedPresets]) => {
      if (cancelled) return
      setMasterItems(loaded)
      setWatchedIds(watched)
      setPresets(savedPresets)
      setItems(weightedSample(loaded, WHEEL_DRAW_SIZE))
      // Only asked when the list is empty, to tell an untouched account
      // apart from one that's been worked all the way through.
      if (loaded.length === 0) {
        const watchedBefore = await hasWatchedItems(userId).catch(() => false)
        if (cancelled) return
        setHasWatchedEver(watchedBefore)
      }
      setLoadingItems(false)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Only the drawn titles are preloaded now — the pool behind them can run
  // to hundreds, and gating the spin on all of those would be a long wait.
  const { statuses: imageStatuses, allSettled: postersReady } = usePosterImages(items)

  // What the filters leave, minus anything set aside or watched this
  // session. The wheel draws its titles from this.
  const matchingPool = applyFilters(masterItems, filters, watchedIds).filter(
    (item) => !setAside.has(item.id) && !watchedThisSession.has(item.id),
  )

  const drawFromPool = useCallback(
    (pool: WheelItem[]) => {
      setItems(weightedSample(pool, WHEEL_DRAW_SIZE))
      setResult(null)
      setRerollsUsed(0)
    },
    [],
  )

  const pendingResultRef = useRef<WheelItem | null>(null)
  const fallbackTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(fallbackTimerRef.current), [])
  useEffect(() => () => window.clearTimeout(undoTimerRef.current), [])

  // Marks the landed spin's outcome. Every spin is logged when it lands;
  // this is what closes it out.
  const closeSpin = useCallback((outcome: SpinOutcome) => {
    const spinId = spinIdRef.current
    if (!spinId) return
    spinIdRef.current = null
    void recordSpinOutcome(spinId, outcome)
  }, [])

  const finishSpin = useCallback(() => {
    if (pendingResultRef.current === null) return
    window.clearTimeout(fallbackTimerRef.current)
    const landed = pendingResultRef.current
    setSpinning(false)
    setResult(landed)
    pendingResultRef.current = null
    navigator.vibrate?.(VIBRATE_PATTERN)
    void recordSpin(userId, landed?.id ?? null, filters).then((id) => {
      spinIdRef.current = id
    })
  }, [userId, filters])

  const spin = useCallback(
    (isReroll: boolean) => {
      // Every spin routes through here — the hub and "Spin again" alike — so
      // this is the one place that reliably sits inside the starting tap.
      void ensureAudioContext()

      if (spinning || items.length === 0 || !postersReady) return
      if (isReroll && rerollsUsed >= MAX_REROLLS) return
      // The spin being replaced is closed out as a reroll before the next
      // one starts.
      if (isReroll) closeSpin('rerolled')

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
    [spinning, items, rerollsUsed, rotation, reduceMotion, finishSpin, postersReady, closeSpin],
  )

  // The only reset trigger: committing to a film ends the round, so the
  // next one starts with a fresh budget.
  // Committing to a film takes it off this user's watchlist and records it
  // as watched today. Only ever touches this user's own rows — a partner
  // logs their own watch. The film drops off the wheel immediately; it
  // stays in masterItems so its poster stays preloaded for an undo.
  const handleWatchThis = () => {
    const watched = result
    closeSpin('watched')
    setResult(null)
    setRerollsUsed(0)
    if (!watched) return

    setItems((current) => current.filter((item) => item.id !== watched.id))
    setWatchedThisSession((current) => new Set(current).add(watched.id))

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
        setWatchedThisSession((current) => {
          const next = new Set(current)
          next.delete(watched.id)
          return next
        })
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
    setWatchedThisSession((current) => {
      const next = new Set(current)
      next.delete(pending.item.id)
      return next
    })
    void undoWatchFilm(userId, pending.snapshot).catch(() => {
      setItems((current) => current.filter((item) => item.id !== pending.item.id))
      setWatchedThisSession((current) => new Set(current).add(pending.item.id))
    })
  }

  // Dismissing (tap-outside or swipe down) just returns to idle — it
  // doesn't commit to anything, so it neither spends nor resets the budget.
  const handleDismiss = () => {
    closeSpin('abandoned')
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
    closeSpin('removed')
    if (removedId) setSetAside((current) => new Set(current).add(removedId))
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

  // Redraws the titles without touching the filters. Anything set aside or
  // watched this session is already out of matchingPool, so a redraw won't
  // bring it back.
  const handleReshuffle = () => {
    closeSpin('abandoned')
    drawFromPool(matchingPool)
  }

  const handleFiltersChange = (next: WheelFilters) => {
    closeSpin('abandoned')
    setFilters(next)
    drawFromPool(
      applyFilters(masterItems, next, watchedIds).filter(
        (item) => !setAside.has(item.id) && !watchedThisSession.has(item.id),
      ),
    )
  }

  const handleSavePreset = (name: string) => {
    void savePreset(userId, name, filters)
      .then((preset) => setPresets((current) => [...current, preset]))
      .catch(() => {})
  }

  const rerollsRemaining = MAX_REROLLS - rerollsUsed
  const canRemoveFromWheel = items.length > MIN_WHEEL_SEGMENTS
  // Nothing to decide at one film, so the hub stops being a spin action.
  const spinDisabled = spinning || !postersReady || result !== null || items.length <= 1

  // Why the wheel is bare, in the user's terms. Films are dropped from
  // `items` but kept in `masterItems`, so the difference between them —
  // minus the ones watched — is what's merely set aside for the session.
  const setAsideCount = setAside.size
  // Fewer than two leaves nothing to decide between, so that's the point at
  // which the wheel gives up and explains itself.
  const tooFewMatches = matchingPool.length < 2
  const emptyReason = (): string => {
    if (masterItems.length === 0) {
      return hasWatchedEver
        ? "You've watched everything on your watchlist. Import a fresh export to add more."
        : 'Your watchlist is empty. Import your Letterboxd export to fill the wheel.'
    }

    // Name the filter that's actually doing the damage, rather than saying
    // "no matches" and leaving the user to guess.
    const culprit = mostRestrictiveFilter(masterItems, filters, watchedIds)
    if (culprit && culprit.wouldMatch > matchingPool.length) {
      return `${matchingPool.length} of ${masterItems.length} titles match. Loosen the ${culprit.label} filter — that alone would bring it to ${culprit.wouldMatch}.`
    }

    const parts: string[] = []
    if (watchedThisSession.size > 0) parts.push(`${watchedThisSession.size} watched`)
    if (setAsideCount > 0) parts.push(`${setAsideCount} set aside for now`)
    if (parts.length === 0) return 'Nothing is on the wheel right now.'
    const tail = setAsideCount > 0 ? ' Reload to bring the set-aside ones back.' : ''
    return `Nothing left on the wheel — ${parts.join(' and ')}.${tail}`
  }

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

      <div className="wheel-controls">
        <div className="wheel-controls-row">
          <button type="button" className="mute-toggle" onClick={() => setFiltersOpen(true)}>
            Filters
          </button>
          <p className="wheel-match-count">
            {items.length} of {matchingPool.length} matching title
            {matchingPool.length === 1 ? '' : 's'}
          </p>
          <button type="button" className="mute-toggle" onClick={handleReshuffle}>
            Reshuffle
          </button>
        </div>
        {presets.length > 0 && (
          <div className="preset-chips">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-chip"
                onClick={() => handleFiltersChange(preset.filters)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <SpinWheel
        items={items}
        rotation={rotation}
        reduceMotion={reduceMotion}
        imageStatuses={imageStatuses}
        onSpinEnd={finishSpin}
        onSpin={() => spin(false)}
        spinDisabled={spinDisabled}
      />

      {tooFewMatches ? (
        <p className="empty-state">{emptyReason()}</p>
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

      {filtersOpen && (
        <FilterSheet
          pool={masterItems}
          filters={filters}
          watchedIds={watchedIds}
          matchCount={matchingPool.length}
          onChange={handleFiltersChange}
          onSavePreset={handleSavePreset}
          onClose={() => setFiltersOpen(false)}
        />
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
