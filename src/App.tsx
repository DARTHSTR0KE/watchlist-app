import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { SpinWheel } from './wheel/SpinWheel'
import { ResultModal } from './wheel/ResultModal'
import type { WheelItem } from './wheel/titles'
import { getSegmentIndexAtPointer } from './wheel/wheelMath'
import { usePosterImages } from './wheel/usePosterImages'
import {
  loadBothRatedItems,
  loadPartner,
  loadRewatchItems,
  loadWatchedFilmIds,
  loadWheelItems,
} from './wheel/loadWheelItems'
import type { Partner } from './wheel/loadWheelItems'
import { SourceToggle } from './wheel/SourceToggle'
import {
  CUSTOM_WHEEL_MAX,
  addFilmToWheel,
  createCustomWheel,
  deleteCustomWheel,
  loadCustomWheelItems,
  loadCustomWheels,
  removeFilmFromWheel,
  renameCustomWheel,
  setCustomWheelShared,
} from './wheel/customWheels'
import type { CustomWheel } from './wheel/customWheels'
import { CustomWheelsScreen } from './wheel/CustomWheelsScreen'
import { CustomWheelEditor } from './wheel/CustomWheelEditor'
import { FilterSheet } from './wheel/FilterSheet'
import { DEFAULT_FILTERS, applyFilters, isCustomSource, mostRestrictiveFilter } from './wheel/filters'
import type { WheelFilters, WheelSource } from './wheel/filters'
import { WHEEL_DRAW_SIZE, weightedSample } from './wheel/weightedDraw'
import {
  MAX_STARRED_PRESETS,
  deletePreset,
  loadPresets,
  recordSpin,
  recordSpinOutcome,
  renamePreset,
  restorePreset,
  savePreset,
  setPresetStarred,
} from './wheel/wheelPersistence'
import type { FilterPreset, SpinOutcome } from './wheel/wheelPersistence'
import { PresetsScreen } from './wheel/PresetsScreen'
import { ensureAudioContext, playTick, useMuted } from './wheel/tickSound'
import { FilmBackdrop } from './wheel/FilmBackdrop'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { SignInScreen } from './auth/SignInScreen'
import { Header } from './auth/Header'
import type { Screen } from './auth/Header'
import { RecommendedScreen } from './social/RecommendedScreen'
import { countUnseenRecommendations, sendRecommendation } from './social/recommendations'
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

// What the wheel may draw from: the filters applied, minus anything set
// aside or watched during this session.
function visiblePool(
  pool: WheelItem[],
  filters: WheelFilters,
  watchedIds: Set<string>,
  setAside: Set<string>,
  watchedThisSession: Set<string>,
): WheelItem[] {
  // A hand-built wheel is spun as assembled — no filter touches it. Only
  // the session-only exclusions still apply.
  const filtered = isCustomSource(filters.source)
    ? pool
    : applyFilters(pool, filters, watchedIds)
  return filtered.filter((item) => !setAside.has(item.id) && !watchedThisSession.has(item.id))
}

// The watchlist and watched sources sample eight from a large pool; a
// hand-built wheel shows everything on it, in order, up to its cap.
function drawFor(source: WheelSource, pool: WheelItem[]): WheelItem[] {
  return isCustomSource(source)
    ? pool.slice(0, CUSTOM_WHEEL_MAX)
    : weightedSample(pool, WHEEL_DRAW_SIZE)
}

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
  // Both forms are needed: the id drives the toggle's disabled state, the
  // ref lets the pool loader read it without reloading when it resolves.
  const [partner, setPartner] = useState<Partner | null>(null)
  const partnerRef = useRef<Partner | null>(null)
  const [customWheels, setCustomWheels] = useState<CustomWheel[]>([])
  const [editorWheel, setEditorWheel] = useState<CustomWheel | null>(null)
  const [editorFilms, setEditorFilms] = useState<WheelItem[]>([])
  // A source switch keeps the old wheel on screen rather than blanking the
  // app, so it needs its own flag to hold the spin until the pool lands.
  const [switchingSource, setSwitchingSource] = useState(false)
  const [sheet, setSheet] = useState<'none' | 'filters' | 'presets' | 'wheels' | 'editor'>('none')
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [deletedPreset, setDeletedPreset] = useState<FilterPreset | null>(null)
  const presetUndoTimerRef = useRef<number | undefined>(undefined)
  const spinIdRef = useRef<string | null>(null)
  const [undo, setUndo] = useState<{
    snapshot: WatchUndoSnapshot
    title: string
    item: WheelItem
  } | null>(null)
  const undoTimerRef = useRef<number | undefined>(undefined)
  const reduceMotion = usePrefersReducedMotion()
  const [muted, toggleMuted] = useMuted()

  // Everything that doesn't depend on which source is selected.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      loadWatchedFilmIds(userId).catch(() => new Set<string>()),
      loadPresets(userId).catch(() => [] as FilterPreset[]),
      loadPartner(userId).catch(() => null),
      // Only asked so an untouched account can be told apart from one
      // that's been worked all the way through.
      hasWatchedItems(userId).catch(() => false),
    ]).then(async ([watched, savedPresets, loadedPartner, watchedBefore]) => {
      if (cancelled) return
      setWatchedIds(watched)
      setPresets(savedPresets)
      partnerRef.current = loadedPartner
      setPartner(loadedPartner)
      setHasWatchedEver(watchedBefore)

      // Needs the partner first, to pick up any wheel they've shared.
      const wheels = await loadCustomWheels(userId, loadedPartner?.id ?? null).catch(
        () => [] as CustomWheel[],
      )
      if (!cancelled) setCustomWheels(wheels)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // The pool loader needs the current filters and session sets, but must
  // not re-run when they change — only when the source does. Declared
  // before that effect so it has always synced by the time it runs.
  const filtersRef = useRef(filters)
  const setAsideRef = useRef(setAside)
  const watchedThisSessionRef = useRef(watchedThisSession)
  const watchedIdsRef = useRef(watchedIds)
  useEffect(() => {
    filtersRef.current = filters
    setAsideRef.current = setAside
    watchedThisSessionRef.current = watchedThisSession
    watchedIdsRef.current = watchedIds
  })

  // Each source is a different table, so switching means reloading rather
  // than filtering what's already in hand.
  const source = filters.source
  const customWheelId = filters.customWheelId
  useEffect(() => {
    let cancelled = false

    const load = (): Promise<WheelItem[]> => {
      if (source === 'rewatch') return loadRewatchItems(userId)
      if (source === 'both-loved') {
        const linked = partnerRef.current
        return linked ? loadBothRatedItems(userId, linked.id) : Promise.resolve([])
      }
      if (source === 'custom') {
        return customWheelId ? loadCustomWheelItems(customWheelId) : Promise.resolve([])
      }
      return loadWheelItems(userId)
    }

    void load()
      .catch(() => [] as WheelItem[])
      .then((loaded) => {
        if (cancelled) return
        setMasterItems(loaded)
        setItems(
          drawFor(
            source,
            visiblePool(
              loaded,
              filtersRef.current,
              watchedIdsRef.current,
              setAsideRef.current,
              watchedThisSessionRef.current,
            ),
          ),
        )
        setResult(null)
        setRerollsUsed(0)
        setLoadingItems(false)
        setSwitchingSource(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, source, customWheelId])

  // Only the drawn titles are preloaded now — the pool behind them can run
  // to hundreds, and gating the spin on all of those would be a long wait.
  const { statuses: imageStatuses, allSettled: postersReady } = usePosterImages(items)

  const matchingPool = visiblePool(masterItems, filters, watchedIds, setAside, watchedThisSession)

  const drawFromPool = useCallback((pool: WheelItem[], forSource: WheelSource) => {
    setItems(drawFor(forSource, pool))
    setResult(null)
    setRerollsUsed(0)
  }, [])

  const pendingResultRef = useRef<WheelItem | null>(null)
  const fallbackTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(fallbackTimerRef.current), [])
  useEffect(() => () => window.clearTimeout(undoTimerRef.current), [])
  useEffect(() => () => window.clearTimeout(presetUndoTimerRef.current), [])

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
        // One undo banner at a time — they share a fixed position.
        window.clearTimeout(presetUndoTimerRef.current)
        setDeletedPreset(null)
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
    drawFromPool(matchingPool, filters.source)
  }

  const handleFiltersChange = (next: WheelFilters) => {
    closeSpin('abandoned')
    setFilters(next)
    // A new source means a different table; the loader draws once it lands,
    // and drawing from the outgoing pool here would only flash the wrong
    // films first.
    if (next.source === filters.source) {
      drawFromPool(visiblePool(masterItems, next, watchedIds, setAside, watchedThisSession), next.source)
    }
  }

  // Editing a wheel that is currently on screen has to move the wheel too.
  const refreshWheelFilms = async (wheelId: string) => {
    const films = await loadCustomWheelItems(wheelId).catch(() => [] as WheelItem[])
    setEditorFilms(films)
    if (filters.customWheelId === wheelId) {
      setMasterItems(films)
      setItems(drawFor('custom', films.filter((f) => !setAside.has(f.id) && !watchedThisSession.has(f.id))))
      setResult(null)
    }
    setCustomWheels((current) =>
      current.map((w) => (w.id === wheelId ? { ...w, filmCount: films.length } : w)),
    )
  }

  const handleCreateWheel = (name: string) => {
    void createCustomWheel(userId, name)
      .then((wheel) => setCustomWheels((current) => [wheel, ...current]))
      .catch(() => {})
  }

  const handleRenameWheel = (wheel: CustomWheel, name: string) => {
    setCustomWheels((current) => current.map((w) => (w.id === wheel.id ? { ...w, name } : w)))
    void renameCustomWheel(wheel.id, name).catch(() => {
      setCustomWheels((current) =>
        current.map((w) => (w.id === wheel.id ? { ...w, name: wheel.name } : w)),
      )
    })
  }

  const handleToggleShared = (wheel: CustomWheel) => {
    const shared = !wheel.shared
    setCustomWheels((current) => current.map((w) => (w.id === wheel.id ? { ...w, shared } : w)))
    void setCustomWheelShared(wheel.id, shared).catch(() => {
      setCustomWheels((current) =>
        current.map((w) => (w.id === wheel.id ? { ...w, shared: wheel.shared } : w)),
      )
    })
  }

  const handleDeleteWheel = (wheel: CustomWheel) => {
    setCustomWheels((current) => current.filter((w) => w.id !== wheel.id))
    // Deleting the wheel being spun leaves nothing selected rather than a
    // wheel pointing at a row that no longer exists.
    if (filters.customWheelId === wheel.id) {
      setFilters((current) => ({ ...current, customWheelId: null }))
    }
    void deleteCustomWheel(wheel.id).catch(() => {
      setCustomWheels((current) => (current.some((w) => w.id === wheel.id) ? current : [wheel, ...current]))
    })
  }

  const handleSpinWheel = (wheel: CustomWheel) => {
    closeSpin('abandoned')
    setSwitchingSource(true)
    setFilters((current) => ({ ...current, source: 'custom', customWheelId: wheel.id }))
    setSheet('none')
  }

  const handleEditWheel = (wheel: CustomWheel) => {
    setEditorWheel(wheel)
    setEditorFilms([])
    setSheet('editor')
    void refreshWheelFilms(wheel.id)
  }

  const handleSourceChange = (next: WheelSource) => {
    if (next === filters.source) return
    if (next === 'custom' && filters.customWheelId === null) {
      setSheet('wheels')
      return
    }
    setSwitchingSource(true)
    handleFiltersChange({ ...filters, source: next })
  }

  const handleSavePreset = (name: string) => {
    // Newest first, matching how the presets screen lists them.
    void savePreset(userId, name, filters)
      .then((preset) => setPresets((current) => [preset, ...current]))
      .catch(() => {})
  }

  // Only starred presets become chips, ordered by when they were starred so
  // they hold a stable position as others come and go.
  const starredPresets = presets
    .filter((preset) => preset.starredAt !== null)
    .sort((a, b) => (a.starredAt ?? '').localeCompare(b.starredAt ?? ''))

  const handleToggleStar = (preset: FilterPreset) => {
    const starring = preset.starredAt === null
    // The cap is enforced here rather than by quietly unstarring the oldest.
    if (starring && starredPresets.length >= MAX_STARRED_PRESETS) return

    void setPresetStarred(preset.id, starring)
      .then((starredAt) => {
        setPresets((current) =>
          current.map((entry) => (entry.id === preset.id ? { ...entry, starredAt } : entry)),
        )
      })
      .catch(() => {})
  }

  const handleRenamePreset = (preset: FilterPreset, name: string) => {
    setPresets((current) =>
      current.map((entry) => (entry.id === preset.id ? { ...entry, name } : entry)),
    )
    void renamePreset(preset.id, name).catch(() => {
      setPresets((current) =>
        current.map((entry) => (entry.id === preset.id ? { ...entry, name: preset.name } : entry)),
      )
    })
  }

  const handleDeletePreset = (preset: FilterPreset) => {
    setPresets((current) => current.filter((entry) => entry.id !== preset.id))
    void deletePreset(preset.id)
      .then(() => {
        window.clearTimeout(presetUndoTimerRef.current)
        window.clearTimeout(undoTimerRef.current)
        setUndo(null)
        setDeletedPreset(preset)
        presetUndoTimerRef.current = window.setTimeout(() => setDeletedPreset(null), UNDO_WINDOW_MS)
      })
      .catch(() => {
        setPresets((current) => (current.some((e) => e.id === preset.id) ? current : [preset, ...current]))
      })
  }

  const handleUndoDeletePreset = () => {
    const preset = deletedPreset
    if (!preset) return
    window.clearTimeout(presetUndoTimerRef.current)
    setDeletedPreset(null)
    setPresets((current) => (current.some((e) => e.id === preset.id) ? current : [preset, ...current]))
    void restorePreset(userId, preset).catch(() => {
      setPresets((current) => current.filter((entry) => entry.id !== preset.id))
    })
  }

  const selectedWheel =
    customWheels.find((wheel) => wheel.id === filters.customWheelId) ?? null

  const rerollsRemaining = MAX_REROLLS - rerollsUsed
  const canRemoveFromWheel = items.length > MIN_WHEEL_SEGMENTS
  // Nothing to decide at one film, so the hub stops being a spin action.
  const spinDisabled =
    spinning || switchingSource || !postersReady || result !== null || items.length <= 1

  // Why the wheel is bare, in the user's terms. Films are dropped from
  // `items` but kept in `masterItems`, so the difference between them —
  // minus the ones watched — is what's merely set aside for the session.
  const setAsideCount = setAside.size
  // Fewer than two leaves nothing to decide between, so that's the point at
  // which the wheel gives up and explains itself.
  const tooFewMatches = matchingPool.length < 2
  const emptyReason = (): string => {
    if (filters.source === 'custom') {
      if (filters.customWheelId === null) return 'Choose one of your wheels to spin.'
      const chosen = customWheels.find((wheel) => wheel.id === filters.customWheelId)
      const name = chosen ? `"${chosen.name}"` : 'This wheel'
      if (masterItems.length === 0) return `${name} is empty. Add films to it.`
      if (matchingPool.length < 2) {
        return `${name} has ${matchingPool.length} film${matchingPool.length === 1 ? '' : 's'} left this session. Add more, or reload to bring back anything set aside.`
      }
    }

    if (masterItems.length === 0) {
      if (filters.source === 'both-loved') {
        return partner === null
          ? 'No partner is linked to this account yet, so there are no shared ratings to draw from.'
          : "Neither of you has rated anything you've both seen yet."
      }
      if (filters.source === 'rewatch') {
        return hasWatchedEver
          ? 'Your watched history is still being enriched. Give it a moment, or import your Letterboxd export.'
          : "You haven't logged anything as watched yet. Import your Letterboxd export to fill the Watch again wheel."
      }
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
        <SourceToggle
          source={filters.source}
          partnerAvailable={partner !== null}
          onChange={handleSourceChange}
        />
        <div className="wheel-controls-row">
          {isCustomSource(filters.source) ? (
            <button type="button" className="mute-toggle" onClick={() => setSheet('wheels')}>
              My wheels
            </button>
          ) : (
            <button type="button" className="mute-toggle" onClick={() => setSheet('filters')}>
              Filters
            </button>
          )}
          <p className="wheel-match-count">
            {switchingSource ? (
              'Loading…'
            ) : isCustomSource(filters.source) ? (
              selectedWheel ? `${selectedWheel.name} · ${items.length}` : 'No wheel selected'
            ) : (
              <>
                {items.length} of {matchingPool.length} matching title
                {matchingPool.length === 1 ? '' : 's'}
              </>
            )}
          </p>
          {isCustomSource(filters.source) ? (
            <button
              type="button"
              className="mute-toggle"
              disabled={selectedWheel === null || !selectedWheel.isMine}
              onClick={() => selectedWheel && handleEditWheel(selectedWheel)}
            >
              Edit
            </button>
          ) : (
            <button type="button" className="mute-toggle" onClick={handleReshuffle}>
              Reshuffle
            </button>
          )}
        </div>
        {/* Presets describe filters, which a hand-built wheel ignores. */}
        {!isCustomSource(filters.source) && starredPresets.length > 0 && (
          <div className="preset-chips">
            {starredPresets.map((preset) => (
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

      {sheet === 'filters' && (
        <FilterSheet
          pool={masterItems}
          filters={filters}
          watchedIds={watchedIds}
          matchCount={matchingPool.length}
          onChange={handleFiltersChange}
          onSavePreset={handleSavePreset}
          onManagePresets={() => setSheet('presets')}
          onClose={() => setSheet('none')}
        />
      )}

      {sheet === 'wheels' && (
        <CustomWheelsScreen
          wheels={customWheels}
          selectedId={filters.customWheelId}
          onCreate={handleCreateWheel}
          onRename={handleRenameWheel}
          onDelete={handleDeleteWheel}
          onToggleShared={handleToggleShared}
          onSpin={handleSpinWheel}
          onEdit={handleEditWheel}
          onBack={() => setSheet('none')}
        />
      )}

      {sheet === 'editor' && editorWheel && (
        <CustomWheelEditor
          wheel={editorWheel}
          films={editorFilms}
          userId={userId}
          partnerId={partner?.id ?? null}
          partnerName={partner?.displayName ?? 'Your partner'}
          onAddFilmId={async (filmId) => {
            await addFilmToWheel(editorWheel.id, filmId)
            await refreshWheelFilms(editorWheel.id)
          }}
          onRemoveFilmId={(filmId) => {
            void removeFilmFromWheel(editorWheel.id, filmId)
              .then(() => refreshWheelFilms(editorWheel.id))
              .catch(() => {})
          }}
          onBack={() => setSheet('wheels')}
        />
      )}

      {sheet === 'presets' && (
        <PresetsScreen
          presets={presets}
          onToggleStar={handleToggleStar}
          onRename={handleRenamePreset}
          onDelete={handleDeletePreset}
          onBack={() => setSheet('filters')}
        />
      )}

      {deletedPreset && (
        <div className="undo-banner" role="status">
          <span className="undo-banner-text">Deleted "{deletedPreset.name}"</span>
          <button type="button" className="undo-banner-action" onClick={handleUndoDeletePreset}>
            Undo
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
          partnerName={partner?.displayName ?? null}
          onRecommend={async (note) => {
            if (!partner) return
            await sendRecommendation(userId, partner.id, result.id, note)
          }}
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
  const [screen, setScreen] = useState<Screen>('wheel')
  const [checkingWatchlist, setCheckingWatchlist] = useState(true)
  const [unseenRecommendations, setUnseenRecommendations] = useState(0)
  const [partnerName, setPartnerName] = useState('your partner')

  useEffect(() => {
    let cancelled = false
    Promise.all([
      hasWatchlistItems(userId).catch(() => true),
      countUnseenRecommendations(userId).catch(() => 0),
      loadPartner(userId).catch(() => null),
    ]).then(([has, unseen, partner]) => {
      if (cancelled) return
      if (!has) setScreen('import')
      setUnseenRecommendations(unseen)
      if (partner) setPartnerName(partner.displayName)
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
        <Header
          screen={screen}
          unseenRecommendations={unseenRecommendations}
          onNavigate={setScreen}
        />
        {screen === 'wheel' && <WheelScreen />}
        {screen === 'import' && <ImportScreen onGoToWheel={() => setScreen('wheel')} />}
        {screen === 'recommended' && (
          <RecommendedScreen
            userId={userId}
            partnerName={partnerName}
            onSeen={() => setUnseenRecommendations(0)}
          />
        )}
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
