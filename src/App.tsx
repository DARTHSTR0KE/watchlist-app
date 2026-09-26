import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { agree, subjectName } from './utils/names'
import type { Json } from './types/supabase'
import './App.css'
import { SpinWheel } from './wheel/SpinWheel'
import { ResultModal } from './wheel/ResultModal'
import type { WheelItem } from './wheel/titles'
import { getSegmentIndexAtPointer, pickSegment, rotationForSegment } from './wheel/wheelMath'
import { usePosterImages } from './wheel/usePosterImages'
import { loadPartner, loadWatchedFilmIds, loadWheelItems } from './wheel/loadWheelItems'
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
import { CustomWheelsList } from './wheel/CustomWheelsScreen'
import { CustomWheelEditor } from './wheel/CustomWheelEditor'
import { FilterSheet } from './wheel/FilterSheet'
import {
  DEFAULT_FILTERS,
  SOURCE_LABELS,
  allowsVeto,
  applyFilters,
  isCustomSource,
  mostRestrictiveFilter,
} from './wheel/filters'
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
import { ensureAudioContext } from './wheel/tickSound'
import { FilmBackdrop } from './wheel/FilmBackdrop'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { SignInScreen } from './auth/SignInScreen'
import { Header } from './auth/Header'
import type { Screen } from './auth/Header'
import { lazyScreen, takeReopenScreen } from './lib/lazyScreen'
import { ScreenBoundary } from './ui/ScreenBoundary'
import { StartupWait } from './ui/StartupWait'
import { TruthOrDareScreen } from './truthOrDare/TruthOrDareScreen'
import { countWaitingForMe } from './truthOrDare/truthOrDare'
import { GameScreen } from './games/GameScreen'
import { GamesScreen } from './games/GamesScreen'
import { dismissRecordNotices, loadRecordNotices } from './games/games'
import { noticeLine } from './games/gameRules'
import type { GameId, RecordNotice } from './games/gameRules'
import { RecommendedScreen } from './social/RecommendedScreen'
import { SettingsScreen } from './settings/SettingsScreen'
import { Onboarding } from './onboarding/Onboarding'
import { loadMyProfile, markOnboarded } from './onboarding/onboardingState'
import { countUnseenRecommendations } from './social/recommendations'
import { SharedListScreen } from './social/SharedListScreen'
import { TogetherChooser } from './social/TogetherChooser'
import { buildTogetherWheel } from './social/togetherWheels'
import { loadSharedList } from './social/sharedList'
import type { TogetherMode } from './wheel/filters'
// Split out on its own: recharts is large, and it is only needed here.
const { Component: StatsScreen, prefetch: prefetchStats } = lazyScreen('stats', () =>
  import('./stats/StatsScreen').then((m) => m.StatsScreen),
)
import { PendingWatchPrompt } from './social/PendingWatchPrompt'
import { LetterboxdPrompt } from './social/LetterboxdPrompt'
import { Splash } from './brand/Splash'
import { logEvent } from './events/events'
import { recordOpen } from './events/presence'
import { reportQuietly } from './lib/dbError'
import { milestoneLine } from './events/milestones'
import type { MilestoneKey } from './events/milestones'
import { SplashLinePrompt } from './social/SplashLinePrompt'
import { GiftPrompt } from './gifts/GiftPrompt'
import { giftYear, promptDue } from './gifts/giftWindow'
import { hasLeftAnything, loadMyGift, promptShown, recordPromptShown } from './gifts/gifts'
import { loadLineFromMe, promptSkippedThisMonth } from './social/splashLines'
import type { SplashLine } from './social/splashLines'
import { EmptyArt } from './brand/EmptyArt'
import { NudgeBanner } from './social/NudgeBanner'
import { BinMoment, NightMoment } from './brand/Moments'
import { WheelDust, WheelWatcher } from './brand/Ambient'
import { useAmbient } from './ambient/ambientStore'
import { setFilterExit } from './wheel/filterExit'
import { applyWarmth, loadReunionDate } from './reunion/reunion'
import { reactionFor } from './ambient/ambient'
import type { Reaction } from './ambient/ambient'
import { loadLandingFacts } from './ambient/landing'
import type { LandingFacts } from './ambient/landing'
import type { Mascot } from './brand/mascots'
import { dismissNudge, loadNudge } from './social/nudges'
import { deliverySnapshot, handledElsewhere, subscribeDelivery } from './social/nudgeDelivery'
import type { Nudge } from './social/nudges'
import { claimColdStart } from './brand/coldStart'
import type { WatchAnswer } from './social/PendingWatchPrompt'
import { WatchedTogetherScreen } from './social/WatchedTogetherScreen'
import { answerWatch, loadPendingWatches, undoWatch } from './social/pendingWatches'
import type { PendingWatch } from './social/pendingWatches'
import { loadSharedListItems } from './social/sharedList'
import { EnrichmentProvider } from './import/EnrichmentContext'
import { ImportScreen } from './import/ImportScreen'
import {
  hasWatchedItems,
  hasWatchlistItems,
  watchFilmNow,
} from './import/watchlistWrites'
import { Footer } from './Footer'
import { BirthdayGate } from './birthday/BirthdayGate'

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
  vetoed: Set<string> = new Set(),
): WheelItem[] {
  // A hand-built wheel is spun as assembled — no filter touches it. Only
  // the session-only exclusions still apply.
  const filtered = isCustomSource(filters.source)
    ? pool
    : applyFilters(pool, filters, watchedIds)
  return filtered.filter(
    (item) => !setAside.has(item.id) && !watchedThisSession.has(item.id) && !vetoed.has(item.id),
  )
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

function WheelScreen({
  startSource,
  startTogetherMode,
}: {
  startSource: WheelSource | null
  startTogetherMode: TogetherMode | null
}) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''

  const [masterItems, setMasterItems] = useState<WheelItem[]>([])
  const [items, setItems] = useState<WheelItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  // Away long enough and the wheel has gathered dust, which the first spin
  // of the session shakes off.
  const ambient = useAmbient()
  const [shaken, setShaken] = useState(false)
  // For the result modal's reactions: what they sent me, and what I keep
  // turning down.
  const landingRef = useRef<LandingFacts>({ recommended: new Set(), rerolled: new Map() })
  // Decided the moment a film lands, so a minute ticking past ten o'clock
  // can't change a reaction that is already showing.
  const [reaction, setReaction] = useState<Reaction | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadLandingFacts(userId).then((facts) => {
      if (!cancelled) landingRef.current = facts
    })
    return () => {
      cancelled = true
    }
  }, [userId])
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
  // The screen remounts whenever you leave and come back, so seeding the
  // source here is all "Spin this list" needs to hand over.
  const [filters, setFilters] = useState<WheelFilters>(() => ({
    ...DEFAULT_FILTERS,
    source: startSource ?? DEFAULT_FILTERS.source,
    togetherMode: startTogetherMode,
  }))
  // Both forms are needed: the id drives the toggle's disabled state, the
  // ref lets the pool loader read it without reloading when it resolves.
  const [partner, setPartner] = useState<Partner | null>(null)
  const partnerRef = useRef<Partner | null>(null)
  // "Nobody linked" and "not looked yet" need different answers: a wheel
  // drawn from their watchlist must wait for the second, not act on it.
  const [partnerLoaded, setPartnerLoaded] = useState(false)
  const [customWheels, setCustomWheels] = useState<CustomWheel[]>([])
  const [editorWheel, setEditorWheel] = useState<CustomWheel | null>(null)
  const [editorFilms, setEditorFilms] = useState<WheelItem[]>([])
  // A source switch keeps the old wheel on screen rather than blanking the
  // app, so it needs its own flag to hold the spin until the pool lands.
  const [switchingSource, setSwitchingSource] = useState(false)
  // Set when Mix could not take an even half from each side.
  const [togetherNote, setTogetherNote] = useState<string | null>(null)
  // Vetoed titles leave the wheel for the session, and each person spends
  // one veto per session. Both reset when the source changes, since that
  // starts a new sitting.
  const [vetoedIds, setVetoedIds] = useState<Set<string>>(new Set())
  const [vetoesSpent, setVetoesSpent] = useState<Set<string>>(new Set())
  const [sheet, setSheet] = useState<'none' | 'filters' | 'presets'>('none')
  // What the filters were when the sheet opened, so closing it can tell
  // whether anything was applied.
  const filtersAtOpenRef = useRef<WheelFilters | null>(null)
  // What Filters is editing. Nothing reaches the wheel until Show; leaving
  // any other way drops it and the filters stay exactly as they were.
  const [filterDraft, setFilterDraft] = useState<WheelFilters | null>(null)
  const [presets, setPresets] = useState<FilterPreset[]>([])
  // Which preset the current filters came from. Without this there is no
  // such thing as an applied preset to undo — applying one only copied its
  // filters in and left nothing behind saying where they came from.
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [deletedPreset, setDeletedPreset] = useState<FilterPreset | null>(null)
  const presetUndoTimerRef = useRef<number | undefined>(undefined)
  const spinIdRef = useRef<string | null>(null)
  const reduceMotion = usePrefersReducedMotion()

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
      setPartnerLoaded(true)
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
  const togetherMode = filters.togetherMode
  const needsPartner = source === 'shared' && togetherMode !== null && togetherMode !== 'ours'
  useEffect(() => {
    // The partner arrives on its own schedule. Loading before it lands
    // would quietly draw the shared list instead of their watchlist, so
    // hold — the effect runs again the moment it resolves.
    if (needsPartner && !partnerLoaded) return
    let cancelled = false
    // Carried out of load() so it lands with the pool it describes, rather
    // than a render ahead of it.
    let note: string | null = null

    const load = (): Promise<WheelItem[]> => {
      if (source === 'custom') {
        return customWheelId ? loadCustomWheelItems(customWheelId) : Promise.resolve([])
      }
      if (source === 'shared') {
        const linked = partnerRef.current
        if (!togetherMode || togetherMode === 'ours' || !linked) return loadSharedListItems()
        return buildTogetherWheel(
          togetherMode,
          userId,
          linked.id,
          linked.displayName,
        ).then((built) => {
          note = built.note
          return built.items
        })
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
            // A new source is a new sitting: vetoes do not carry over, so
            // none are excluded here.
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
        setVetoedIds(new Set())
        setVetoesSpent(new Set())
        setLoadingItems(false)
        setSwitchingSource(false)
        setTogetherNote(note)
      })

    return () => {
      cancelled = true
    }
  }, [userId, source, customWheelId, togetherMode, needsPartner, partnerLoaded])

  // Only the drawn titles are preloaded now — the pool behind them can run
  // to hundreds, and gating the spin on all of those would be a long wait.
  const { statuses: imageStatuses, allSettled: postersReady } = usePosterImages(items)

  const matchingPool = visiblePool(
    masterItems,
    filters,
    watchedIds,
    setAside,
    watchedThisSession,
    vetoedIds,
  )

  const drawFromPool = useCallback((pool: WheelItem[], forSource: WheelSource) => {
    setItems(drawFor(forSource, pool))
    setResult(null)
    setRerollsUsed(0)
  }, [])

  const pendingResultRef = useRef<WheelItem | null>(null)
  const fallbackTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(fallbackTimerRef.current), [])
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
    setReaction(
      landed
        ? reactionFor(
            {
              recommendedByPartner: landingRef.current.recommended.has(landed.id),
              rerolledAway: landingRef.current.rerolled.get(landed.id) ?? 0,
              runtimeMinutes: landed.runtimeMinutes,
              genres: landed.genres,
            },
            new Date(),
          )
        : null,
    )
    setResult(landed)
    pendingResultRef.current = null
    navigator.vibrate?.(VIBRATE_PATTERN)
    logEvent('spin', { filmId: landed?.id ?? null })
    void recordSpin(userId, landed?.id ?? null, filters).then((id) => {
      spinIdRef.current = id
    })
  }, [userId, filters])

  // Takes the list explicitly, because a veto has to spin the wheel that is
  // about to render rather than the one still in state.
  const spinList = useCallback(
    (list: WheelItem[], isReroll: boolean) => {
      // Every spin routes through here — the hub and "Spin again" alike — so
      // this is the one place that reliably sits inside the starting tap.
      void ensureAudioContext()

      if (spinning || list.length === 0 || !postersReady) return
      if (isReroll && rerollsUsed >= MAX_REROLLS) return
      // The spin being replaced is closed out as a reroll before the next
      // one starts.
      if (isReroll) {
        closeSpin('rerolled')
        // The film turned down, not the one about to land.
        logEvent('reroll', { filmId: result?.id ?? null })
        if (result) {
          const rerolled = landingRef.current.rerolled
          rerolled.set(result.id, (rerolled.get(result.id) ?? 0) + 1)
        }
      }

      // Spin again must not land back on the film it is replacing.
      const index = pickSegment(
        list.map((item) => item.id),
        result?.id ?? null,
      )
      const nextRotation = rotationForSegment(rotation, index, list.length)
      pendingResultRef.current = list[index] ?? null

      setResult(null)
      setSpinning(true)
      setShaken(true)
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
    [spinning, rerollsUsed, rotation, reduceMotion, finishSpin, postersReady, closeSpin, result],
  )

  const spin = useCallback(
    (isReroll: boolean) => spinList(items, isReroll),
    [spinList, items],
  )

  // The only reset trigger: committing to a film ends the round, so the
  // next one starts with a fresh budget.
  // Committing to a film takes it off this user's watchlist and records it
  // as watched today. Only ever touches this user's own rows — a partner
  // logs their own watch. The film drops off the wheel immediately; it
  // stays in masterItems so its poster stays loaded if it comes back.
  const handleWatchThis = () => {
    const watched = result
    closeSpin('watched')
    setResult(null)
    setRerollsUsed(0)
    if (!watched) return

    setItems((current) => current.filter((item) => item.id !== watched.id))
    setWatchedThisSession((current) => new Set(current).add(watched.id))

    // Nothing is asked here. You are about to start a film; the question
    // of who you watched it with waits until the app next opens.
    void watchFilmNow(userId, watched.id)
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
    logEvent('not_tonight', { filmId: removedId ?? null })
    if (removedId) setSetAside((current) => new Set(current).add(removedId))
    setItems((current) =>
      current.length > MIN_WHEEL_SEGMENTS ? current.filter((item) => item.id !== removedId) : current,
    )
    setResult(null)
  }

  // Redraws the titles without touching the filters. Anything set aside or
  // watched this session is already out of matchingPool, so a redraw won't
  // bring it back.
  const handleReshuffle = () => {
    closeSpin('abandoned')
    drawFromPool(matchingPool, filters.source)
  }

  // fromPreset is passed only by a chip. Every other route through here —
  // the filter sheet, Clear all, a source switch — leaves no preset
  // applied, which is what makes the chip and the Clear button agree.
  const handleFiltersChange = (next: WheelFilters, fromPreset: string | null = null) => {
    closeSpin('abandoned')
    setActivePresetId(fromPreset)
    setFilters(next)
    // A preset lands all at once, so it is one application. The sheet's
    // chip-by-chip changes are logged once, when it closes.
    if (fromPreset) {
      logEvent('filter_applied', {
        detail: { preset_id: fromPreset, filters: next as unknown as Json },
      })
    }
    // A new source means a different table; the loader draws once it lands,
    // and drawing from the outgoing pool here would only flash the wrong
    // films first.
    if (next.source === filters.source) {
      drawFromPool(
        visiblePool(masterItems, next, watchedIds, setAside, watchedThisSession, vetoedIds),
        next.source,
      )
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
  }

  const handleEditWheel = (wheel: CustomWheel) => {
    setEditorWheel(wheel)
    setEditorFilms([])
    void refreshWheelFilms(wheel.id)
  }

  // One veto each per sitting. The title leaves the wheel and the wheel
  // goes again straight away — spun with the list that is about to render,
  // not the one still in state.
  const handleVeto = (key: string) => {
    const vetoed = result
    if (!vetoed || vetoesSpent.has(key)) return
    closeSpin('removed')
    // Whose veto it was; the film says what was vetoed.
    logEvent('veto', { filmId: vetoed.id, detail: { by: key } })

    const next = items.filter((item) => item.id !== vetoed.id)
    setVetoesSpent((current) => new Set(current).add(key))
    setVetoedIds((current) => new Set(current).add(vetoed.id))
    setItems(next)
    setResult(null)

    // Below two there is nothing left to decide between, so the wheel says
    // so rather than spinning at itself.
    if (next.length >= MIN_WHEEL_SEGMENTS) spinList(next, false)
  }

  // Filters is a place of its own now, so it needs a way back that commits
  // to nothing: the header's back control, the Wheel tab, and the phone's
  // own back button all leave it with the filters exactly as they were.
  const openFilters = () => {
    filtersAtOpenRef.current = filters
    setFilterDraft(filters)
    setSheet('filters')
    window.history.pushState({ chhobidamFilters: true }, '')
  }

  const leaveFilters = useCallback(() => {
    // The back button's entry goes with it; its popstate does the closing.
    if ((window.history.state as { chhobidamFilters?: boolean } | null)?.chhobidamFilters) {
      window.history.back()
    } else {
      setSheet('none')
      setFilterDraft(null)
    }
  }, [])

  useEffect(() => {
    if (sheet === 'none') return
    const onPop = () => {
      // Back from presets goes to Filters, not past it.
      if (sheet === 'presets') {
        setSheet('filters')
        window.history.pushState({ chhobidamFilters: true }, '')
        return
      }
      setSheet('none')
      setFilterDraft(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [sheet])

  useEffect(() => {
    if (sheet === 'none') return
    setFilterExit(leaveFilters)
    return () => setFilterExit(null)
  }, [sheet, leaveFilters])

  const applyDraft = (draft: WheelFilters) => {
    if (JSON.stringify(filtersAtOpenRef.current) !== JSON.stringify(draft)) {
      logEvent('filter_applied', { detail: { filters: draft as unknown as Json } })
    }
    handleFiltersChange(draft)
    leaveFilters()
  }

  const vetoOptions = allowsVeto(filters.source)
    ? [
        {
          key: 'me',
          label: vetoesSpent.has('me') ? 'You vetoed this' : 'You veto this',
          used: vetoesSpent.has('me'),
        },
        ...(partner
          ? [
              {
                key: 'partner',
                label: vetoesSpent.has('partner')
                  ? `${subjectName(partner.displayName, true)} vetoed this`
                  : `${subjectName(partner.displayName, true)} ${agree(partner.displayName, 'vetoes', 'veto')} this`,
                used: vetoesSpent.has('partner'),
              },
            ]
          : []),
      ]
    : []

  const handleSourceChange = (next: WheelSource) => {
    if (next === filters.source) return
    setSwitchingSource(true)
    handleFiltersChange({ ...filters, source: next })
  }

  const handleSavePreset = (name: string, which: WheelFilters = filters) => {
    // Newest first, matching how the presets screen lists them.
    void savePreset(userId, name, which)
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
  // Local hours, from local parts — the same rule every date fact here
  // follows. Checked on render rather than held, so it can't go stale.
  const smallHours = new Date().getHours() < 5
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
  // A wheel with nothing on it and a filter that matched nothing are two
  // different disappointments. Nothing matched means there is a pile to go
  // through and nothing in it, which is what the bin is for.
  const nothingMatched = masterItems.length > 0
  const emptyReason = (): string => {
    if (filters.source === 'shared' && masterItems.length === 0) {
      return 'Your watch together list is empty. Add films to it on the Together screen.'
    }


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

  // Never a blank screen while the pool loads: if Supabase is slow, this
  // says so.
  if (loadingItems) return <StartupWait />

  // Filling a wheel is a screen of its own, not a panel over the wheel.
  if (editorWheel) {
    return (
      <CustomWheelEditor
        wheel={editorWheel}
        films={editorFilms}
        userId={userId}
        partnerId={partner?.id ?? null}
        onAddFilmId={async (filmId) => {
          await addFilmToWheel(editorWheel.id, filmId)
          await refreshWheelFilms(editorWheel.id)
        }}
        onRemoveFilmId={(filmId) => {
          void removeFilmFromWheel(editorWheel.id, filmId)
            .then(() => refreshWheelFilms(editorWheel.id))
            .catch(() => {})
        }}
        onRename={(name) => {
          handleRenameWheel(editorWheel, name)
          setEditorWheel({ ...editorWheel, name })
        }}
        onBack={() => setEditorWheel(null)}
      />
    )
  }

  // My wheels with nothing chosen: the wheel area becomes the list, in
  // place, rather than a sheet sliding over a wheel nobody picked.
  const pickingWheel = filters.source === 'custom' && filters.customWheelId === null
  // Filters and presets take over the wheel area rather than sliding over
  // it. Nothing in the app is a sheet any more.
  const inPlacePanel = sheet !== 'none'

  return (
    <div className="app">
      <FilmBackdrop backdropPath={displayedBackdrop} />
      {/* Filters and presets bring their own ticket to the top. */}
      {!inPlacePanel && <h1 className="app-title">Innu ki dekhbo?</h1>}

      <div className="wheel-controls" hidden={inPlacePanel}>
        <SourceToggle source={filters.source} onChange={handleSourceChange} />
        {!pickingWheel && !inPlacePanel && (
        <div className="wheel-controls-row">
          {filters.source === 'custom' ? (
            <button
              type="button"
              className="mute-toggle"
              onClick={() => handleFiltersChange({ ...filters, customWheelId: null })}
            >
              My wheels
            </button>
          ) : (
            <button
              type="button"
              className="mute-toggle"
              // The shared list is spun exactly as assembled, so there is
              // nothing here for filters to do.
              disabled={filters.source === 'shared'}
              onClick={openFilters}
            >
              Filters
            </button>
          )}
          <p className="wheel-match-count">
            {switchingSource ? (
              'Loading…'
            ) : filters.source === 'custom' ? (
              selectedWheel ? `${selectedWheel.name} · ${items.length}` : 'No wheel selected'
            ) : filters.source === 'shared' ? (
              `${SOURCE_LABELS.shared} · ${items.length}`
            ) : (
              <>
                {items.length} of {matchingPool.length} matching title
                {matchingPool.length === 1 ? '' : 's'}
              </>
            )}
          </p>
          {filters.source === 'custom' ? (
            <button
              type="button"
              className="mute-toggle"
              disabled={selectedWheel === null || !selectedWheel.isMine}
              onClick={() => selectedWheel && handleEditWheel(selectedWheel)}
            >
              Edit
            </button>
          ) : (
            <button
              type="button"
              className="mute-toggle"
              // Nothing to redraw when the whole list is already on screen.
              disabled={filters.source === 'shared'}
              onClick={handleReshuffle}
            >
              Reshuffle
            </button>
          )}
        </div>
        )}
        {/* Presets describe filters, which a hand-built wheel ignores. */}
        {!inPlacePanel && !isCustomSource(filters.source) && starredPresets.length > 0 && (
          <div className="preset-chips">
            {starredPresets.map((preset) => {
              const active = preset.id === activePresetId
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`preset-chip${active ? ' preset-chip-on' : ''}`}
                  aria-pressed={active}
                  // Tapping the one already on takes it off. The way back
                  // to no preset was otherwise unpicking every filter by
                  // hand, one at a time.
                  onClick={() =>
                    active
                      ? handleFiltersChange({
                          ...DEFAULT_FILTERS,
                          source: filters.source,
                          customWheelId: filters.customWheelId,
                          togetherMode: filters.togetherMode,
                        })
                      : handleFiltersChange(preset.filters, preset.id)
                  }
                >
                  {preset.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {inPlacePanel ? null : pickingWheel ? (
        <CustomWheelsList
          wheels={customWheels}
          partnerName={partner?.displayName ?? null}
          onCreate={handleCreateWheel}
          onSpin={handleSpinWheel}
          onEdit={handleEditWheel}
          onDelete={handleDeleteWheel}
          onToggleShared={handleToggleShared}
        />
      ) : (
        <>
          <SpinWheel
            items={items}
            rotation={rotation}
            reduceMotion={reduceMotion}
            imageStatuses={imageStatuses}
            onSpinEnd={finishSpin}
            onSpin={() => spin(false)}
            spinDisabled={spinDisabled}
            overlay={
              <>
                {ambient.away && !shaken && <WheelDust />}
                {spinning && <WheelWatcher />}
              </>
            }
          />

          {togetherNote && <p className="empty-state">{togetherNote}</p>}
          {tooFewMatches ? (
            <p className="empty-state empty-state-art">
              {nothingMatched ? <BinMoment /> : <EmptyArt kind="raccoon" />}
              <span>
                {nothingMatched && <span className="empty-lead">Nothing in here. </span>}
                {emptyReason()}
              </span>
            </p>
          ) : (
            <div className="wheel-footer-row">
              <p className="wheel-remaining-count">
                {items.length} title{items.length === 1 ? '' : 's'} on the wheel
              </p>
              {/* Still up, and so is she. */}
              {smallHours && <NightMoment />}
            </div>
          )}
        </>
      )}

      {sheet === 'filters' && (
        <FilterSheet
          pool={masterItems}
          applied={filters}
          drawn={items}
          draft={filterDraft ?? filters}
          watchedIds={watchedIds}
          poolFor={(which) =>
            visiblePool(masterItems, which, watchedIds, setAside, watchedThisSession, vetoedIds)
          }
          onDraftChange={setFilterDraft}
          onApply={applyDraft}
          onSavePreset={handleSavePreset}
          onManagePresets={() => setSheet('presets')}
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



      {result && (
        <ResultModal
          item={result}
          reaction={reaction}
          vetoes={vetoOptions}
          onVeto={handleVeto}
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
  // Back where you were if the app had to reload onto a new deploy to
  // open Stats; otherwise the wheel.
  const [screen, setScreen] = useState<Screen>(() =>
    takeReopenScreen() === 'stats' ? 'stats' : 'wheel',
  )
  const [checkingWatchlist, setCheckingWatchlist] = useState(true)
  const [unseenRecommendations, setUnseenRecommendations] = useState(0)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  // My own name lives here, not in the header, so settings can change it
  // and every screen showing it updates at once.
  const [myName, setMyName] = useState<string | null>(null)
  // Three states, not one null: still loading, read, or unreadable. A
  // missing row is a real condition to report, not an empty name.
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ready' | 'unreadable'>('loading')
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  // Set only by "Spin this list"; cleared by any ordinary navigation, so
  // the wheel doesn't keep reopening on the shared list afterwards.
  const [wheelSource, setWheelSource] = useState<WheelSource | null>(null)
  const [wheelTogetherMode, setWheelTogetherMode] = useState<TogetherMode | null>(null)
  const [sharedCount, setSharedCount] = useState<number | null>(null)
  // The shared list is edited from the chooser rather than being it, so
  // it needs its own way in.
  const [editingSharedList, setEditingSharedList] = useState(false)
  // Truth or dare lives inside Together, the same way.
  const [playingTruthOrDare, setPlayingTruthOrDare] = useState(false)
  // Their turns waiting for me, counted on opening: the game is
  // asynchronous, so this is how I hear it's my go.
  const [truthOrDareWaiting, setTruthOrDareWaiting] = useState(0)
  // One of the two games, inside Together, while it is open.
  const [playingGame, setPlayingGame] = useState<GameId | null>(null)
  // The Games screen inside Together, which holds all three.
  const [showingGames, setShowingGames] = useState(false)
  // Records of mine they beat since I last looked. Told in the nudge
  // banner, after any nudge they wrote.
  const [recordNotices, setRecordNotices] = useState<RecordNotice[]>([])
  // Watches recorded but not yet asked about. Dismissing hides the prompt
  // for this session only; the rows stay unanswered and come back next
  // time the app opens.
  const [pendingWatches, setPendingWatches] = useState<PendingWatch[]>([])
  const [promptDismissed, setPromptDismissed] = useState(false)
  // The film just answered for, held while its Letterboxd step is up. The
  // queue has already moved on underneath it.
  const [ratePrompt, setRatePrompt] = useState<PendingWatch | null>(null)
  // Whatever they left for me since I last had the app open.
  const [nudge, setNudge] = useState<Nudge | null>(null)
  // Re-reads whenever the splash claims, speaks or releases one, so the
  // banner appears the moment the splash decides not to deliver it.
  useSyncExternalStore(subscribeDelivery, deliverySnapshot)
  // Spoken on the splash means already delivered; the banner stays out of
  // the way rather than showing the same message a second time.
  const bannerNudge = handledElsewhere(nudge) ? null : nudge
  // Both read from profiles.mascot, never decided here.
  const [myMascot, setMyMascot] = useState<Mascot | null>(null)
  const [partnerMascot, setPartnerMascot] = useState<Mascot | null>(null)
  // The line I wrote for them, while the prompt to write one is up. The
  // prompt comes before anything else once the splash has gone.
  const [linePrompt, setLinePrompt] = useState<{ current: SplashLine | null } | null>(null)
  // A milestone reached since the last open: one line, on the first screen
  // this session, gone once you move on.
  const [milestone, setMilestone] = useState<MilestoneKey | null>(null)
  // December: which of the three gift prompt days is up, while nothing has
  // been left for them yet.
  const [giftPrompt, setGiftPrompt] = useState<{ year: number; day: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    // Straight away, while the build this page came from is still cached.
    prefetchStats()
    Promise.all([
      hasWatchlistItems(userId).catch(() => true),
      loadMyProfile(userId).catch(() => null),
      countUnseenRecommendations(userId).catch(() => 0),
      loadPartner(userId).catch(() => null),
    ]).then(async ([has, profile, unseen, partner]) => {
      if (cancelled) return
      setMyName(profile?.displayName ?? null)
      setMyMascot(profile?.mascot ?? null)
      setProfileStatus(profile ? 'ready' : 'unreadable')
      // A profile that can't be read is not evidence the walkthrough is
      // due, so it stays out of the way rather than showing on every open.
      if (profile && profile.onboardedAt === null) setNeedsOnboarding(true)
      if (!has) setScreen('import')
      setUnseenRecommendations(unseen)
      if (partner) {
        setPartnerName(partner.displayName)
        setPartnerId(partner.id)
        setPartnerMascot(partner.mascot)
      }
      setCheckingWatchlist(false)

      if (partner) {
        void loadRecordNotices()
          .then((notices) => {
            if (!cancelled) setRecordNotices(notices)
          })
          .catch((error: unknown) => reportQuietly('Checking for a beaten record', error))
        void countWaitingForMe(userId)
          .then((waiting) => {
            if (!cancelled) setTruthOrDareWaiting(waiting)
          })
          .catch((error: unknown) => reportQuietly('Checking for a truth or dare turn', error))
      }

      // The shared date, and how warm that makes everything. Never waited on.
      void loadReunionDate(userId)

      // Logged quietly and never waited on by anything else.
      void recordOpen(userId).then((opened) => {
        if (cancelled || !opened) return
        setMilestone(opened.milestone)
      })

      // Only while I have never written them one, and not again this
      // month once skipped. A failed read asks nothing: better silent than
      // asking someone who already wrote one.
      if (partner && !promptSkippedThisMonth()) {
        const mine = await loadLineFromMe(userId, partner.id).catch((error: unknown) => {
          reportQuietly('Checking for a splash line you wrote', error)
          return undefined
        })
        if (!cancelled && mine === null) setLinePrompt({ current: null })
      }

      // The December prompt: at most three times a year, and only while
      // nothing has been left. A failed read asks nothing.
      const now = new Date()
      const dueDay = promptDue(now)
      const year = giftYear(now)
      if (partner && dueDay !== null && !promptShown(year, dueDay)) {
        const left = await loadMyGift(userId, year)
          .then(hasLeftAnything)
          .catch((error: unknown) => {
            reportQuietly('Checking for a Wrapped gift', error)
            return true
          })
        if (!cancelled && !left) setGiftPrompt({ year, day: dueDay })
      }

      // Asked on opening, which is the whole point of not asking at the
      // moment of watching.
      const queue = await loadPendingWatches(userId).catch(() => [] as PendingWatch[])
      if (!cancelled) setPendingWatches(queue)

      // Never blocks anything: if the table isn't there yet this simply
      // resolves to nothing and no banner appears.
      const waiting = await loadNudge(userId).catch(() => null)
      if (!cancelled) setNudge(waiting)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Counted again on the way back from the editor, so the chooser doesn't
  // keep quoting a number from before you added to it.
  useEffect(() => {
    let cancelled = false
    void loadSharedList()
      .catch(() => [])
      .then((rows) => {
        if (!cancelled) setSharedCount(rows.length)
      })
    return () => {
      cancelled = true
    }
  }, [editingSharedList])

  const handleWatchAnswer = (watch: PendingWatch, answer: WatchAnswer) => {
    // Off the queue straight away: a failed write leaves the row
    // unanswered, so it simply comes back next time rather than stalling
    // the question in front of you.
    setPendingWatches((current) => current.filter((entry) => entry.filmId !== watch.filmId))

    if (answer === 'not-watched') {
      void undoWatch(userId, watch).catch(() => {})
      return
    }
    void answerWatch(userId, watch.filmId, answer === 'together').catch(() => {})
    // Having just said you watched it, the next thing you would do is rate
    // it. Only after a yes — nothing to rate if it went back on the list.
    setRatePrompt(watch)
  }

  if (checkingWatchlist) return <StartupWait />

  return (
    <EnrichmentProvider>
      <div className="app-shell">
        {/* Above everything, dismissible, never in the way. */}
        {bannerNudge && (
          <NudgeBanner
            message={bannerNudge.message}
            fromName={partnerName}
            fromMascot={partnerMascot}
            onDismiss={() => {
              const from = bannerNudge.fromUser
              setNudge(null)
              void dismissNudge(userId, from).catch(() => {})
            }}
          />
        )}
        {!bannerNudge && noticeLine(recordNotices) && (
          <NudgeBanner
            message={noticeLine(recordNotices) ?? ''}
            fromName={partnerName}
            fromMascot={partnerMascot}
            onDismiss={() => {
              const ids = recordNotices.map((notice) => notice.id)
              setRecordNotices([])
              void dismissRecordNotices(ids).catch((error: unknown) =>
                reportQuietly('Dismissing a beaten record', error),
              )
            }}
          />
        )}
        <Header
          screen={screen}
          displayName={myName}
          unseenRecommendations={unseenRecommendations}
          onNavigate={(next) => {
            setMilestone(null)
            setWheelSource(null)
            setWheelTogetherMode(null)
            setEditingSharedList(false)
            setPlayingTruthOrDare(false)
            setPlayingGame(null)
            setShowingGames(false)
            setScreen(next)
          }}
        />
        {milestone && <p className="milestone-line">{milestoneLine(milestone, partnerName)}</p>}
        {truthOrDareWaiting > 0 && !(screen === 'together' && playingTruthOrDare) && (
          <button
            type="button"
            className="td-waiting-line"
            onClick={() => {
              setMilestone(null)
              setEditingSharedList(false)
              setShowingGames(true)
              setPlayingTruthOrDare(true)
              setTruthOrDareWaiting(0)
              setScreen('together')
            }}
          >
            {subjectName(partnerName, true)} took a turn at truth or dare. Yours next ›
          </button>
        )}
        {/* Keyed by screen, so moving on clears a screen that broke. */}
        <ScreenBoundary key={screen}>
          {screen === 'wheel' && (
            <WheelScreen startSource={wheelSource} startTogetherMode={wheelTogetherMode} />
          )}
          {screen === 'stats' && (
            <Suspense fallback={null}>
              <StatsScreen userId={userId} partnerId={partnerId} partnerName={partnerName} />
            </Suspense>
          )}
          {screen === 'watched-together' && (
            <WatchedTogetherScreen userId={userId} partnerName={partnerName} />
          )}
          {screen === 'together' &&
            (playingGame ? (
            <GameScreen
              game={playingGame}
              userId={userId}
              partnerId={partnerId}
              partnerName={partnerName}
              onBack={() => setPlayingGame(null)}
              onGoToImport={() => {
                setPlayingGame(null)
                setScreen('import')
              }}
            />
          ) : playingTruthOrDare ? (
            <TruthOrDareScreen
              userId={userId}
              partnerId={partnerId}
              partnerName={partnerName}
              onBack={() => setPlayingTruthOrDare(false)}
            />
          ) : showingGames ? (
            <GamesScreen
              userId={userId}
              partnerId={partnerId}
              partnerName={partnerName}
              onBack={() => setShowingGames(false)}
              onPlayGame={setPlayingGame}
              onPlayTruthOrDare={() => {
                setPlayingTruthOrDare(true)
                // Opening the game is seeing them; the game itself
                // puts their turns in front of me.
                setTruthOrDareWaiting(0)
              }}
            />
          ) : editingSharedList ? (
              <SharedListScreen
                userId={userId}
                partnerId={partnerId}
                onSpinList={() => {
                  setEditingSharedList(false)
                  setWheelSource('shared')
                  setWheelTogetherMode('ours')
                  setScreen('wheel')
                }}
              />
            ) : (
              <TogetherChooser
                partnerId={partnerId}
                partnerName={partnerName}
                sharedCount={sharedCount}
                // Picking builds the wheel and goes to it: one tap for one
                // intention, rather than choosing a mode and then navigating.
                onChoose={(mode) => {
                  setWheelSource('shared')
                  setWheelTogetherMode(mode)
                  setScreen('wheel')
                }}
                onEditSharedList={() => setEditingSharedList(true)}
                onOpenGames={() => setShowingGames(true)}
                truthOrDareWaiting={truthOrDareWaiting}
              />
            ))}
          {screen === 'import' && <ImportScreen onGoToWheel={() => setScreen('wheel')} />}
          {screen === 'settings' && (
            <SettingsScreen
              userId={userId}
              partnerId={partnerId}
              partnerName={partnerName}
              displayName={myName}
              myMascot={myMascot}
              profileStatus={profileStatus}
              onDisplayNameChange={setMyName}
              onGoToImport={() => setScreen('import')}
              onDataCleared={() => {
                // Nothing the shell is holding survived the wipe: the queue
                // is empty, the shared list is empty, and an account with no
                // watchlist belongs on the import screen again.
                setPendingWatches([])
                setNudge(null)
                setSharedCount(0)
                setUnseenRecommendations(0)
                setWheelSource(null)
                setWheelTogetherMode(null)
                setNeedsOnboarding(true)
                setScreen('import')
              }}
            />
          )}
          {screen === 'recommended' && (
            <RecommendedScreen
              userId={userId}
              partnerId={partnerId}
              partnerName={partnerName}
              partnerMascot={partnerMascot}
              myMascot={myMascot}
              onSeen={() => setUnseenRecommendations(0)}
            />
          )}
        </ScreenBoundary>
        <Footer />

        {linePrompt && partnerId && (
          <SplashLinePrompt
            userId={userId}
            partnerId={partnerId}
            partnerName={partnerName}
            current={linePrompt.current}
            onDone={() => setLinePrompt(null)}
          />
        )}

        {!linePrompt && needsOnboarding && (
          <Onboarding
            partnerName={partnerName}
            onDone={() => {
              setNeedsOnboarding(false)
              // Finishing and skipping are the same commitment; a failed
              // write just means it is offered once more.
              void markOnboarded(userId).catch(() => {})
            }}
            onGoToImport={() => {
              setNeedsOnboarding(false)
              void markOnboarded(userId).catch(() => {})
              setScreen('import')
            }}
          />
        )}

        {/* The walkthrough comes first: a new account has nothing to be
            asked about anyway. */}
        {giftPrompt && !linePrompt && !needsOnboarding && (
          <GiftPrompt
            partnerName={partnerName}
            onLeaveSomething={() => {
              recordPromptShown(giftPrompt.year, giftPrompt.day)
              setGiftPrompt(null)
              setScreen('settings')
            }}
            onDismiss={() => {
              recordPromptShown(giftPrompt.year, giftPrompt.day)
              setGiftPrompt(null)
            }}
          />
        )}

        {!linePrompt &&
          !giftPrompt &&
          !needsOnboarding &&
          !promptDismissed &&
          // One at a time: the rating step stands in front of the next
          // film's question until it is answered either way.
          (ratePrompt ? (
            <LetterboxdPrompt watch={ratePrompt} onDone={() => setRatePrompt(null)} />
          ) : (
            <PendingWatchPrompt
              pending={pendingWatches}
              partnerName={partnerName}
              onAnswer={handleWatchAnswer}
              onDismiss={() => setPromptDismissed(true)}
            />
          ))}
      </div>
    </EnrichmentProvider>
  )
}

function Gate() {
  const { session, loading } = useAuth()

  // Still restoring the persisted session: a wait, rather than flashing
  // the sign-in screen or showing nothing.
  if (loading) return <StartupWait />

  if (!session) return <SignInScreen />

  return <AuthenticatedApp />
}

function App() {
  // Claimed during the first render of the first mount and never again, so
  // resuming a backgrounded app does not re-run it. Nothing here is
  // awaited: the app mounts and loads underneath the splash.
  const [splashing, setSplashing] = useState(claimColdStart)

  // The day turns over at midnight and the app may be open across it, or
  // left in the background for days: re-read the warmth whenever it comes
  // back into view, and once a minute while it is.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === 'visible') applyWarmth()
    }
    document.addEventListener('visibilitychange', recheck)
    const timer = window.setInterval(recheck, 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', recheck)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <AuthProvider>
      {/* Nothing to do with the birthday video, which is a once-a-year
          thing on one date. This one runs all year, on cold start. */}
      {splashing && <Splash onDone={() => setSplashing(false)} />}
      {/* Above the auth gate deliberately: the video comes before the
          sign-in screen, so a first open isn't a password prompt. */}
      <BirthdayGate />
      <Gate />
    </AuthProvider>
  )
}

export default App
