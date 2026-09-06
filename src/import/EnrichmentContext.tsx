import { createContext, useCallback, useContext, useReducer } from 'react'
import type { ReactNode } from 'react'
import { asyncPool } from '../lib/asyncPool'
import { resolveCandidate, resolveFilm } from './matching'
import type { Candidate, MatchOutcome } from './matching'
import { parseLetterboxdFiles } from './letterboxdParser'
import type { LetterboxdRatingRow, LetterboxdRow } from './letterboxdParser'
import {
  computeWatchlistDiff,
  insertNewWatchlistItems,
  recordImport,
  upsertFilm,
  upsertWatchedEntries,
} from './watchlistWrites'
import type { WatchlistCsvEntry, WatchlistDiff, WatchedCsvEntry } from './watchlistWrites'

export interface ReviewItem {
  key: string
  name: string
  year: number | null
  candidates: Candidate[]
  destination:
    | { type: 'watchlist'; addedAt: string; letterboxdUri: string | null }
    | { type: 'watched'; rating: number | null; watchedOn: string | null }
}

interface Progress {
  completed: number
  total: number
}

type Phase = 'idle' | 'enriching-watchlist' | 'awaiting-confirmation' | 'ready'

interface PendingImport {
  filename: string
  rowsInFile: number
  newEntries: WatchlistCsvEntry[]
  diff: WatchlistDiff
}

interface EnrichmentState {
  phase: Phase
  watchlistProgress: Progress | null
  watchedProgress: Progress | null
  watchedRunning: boolean
  pendingImport: PendingImport | null
  reviewItems: ReviewItem[]
  error: string | null
}

const initialState: EnrichmentState = {
  phase: 'idle',
  watchlistProgress: null,
  watchedProgress: null,
  watchedRunning: false,
  pendingImport: null,
  reviewItems: [],
  error: null,
}

type Action =
  | { type: 'start' }
  | { type: 'error'; message: string }
  | { type: 'watchlist-progress'; completed: number; total: number }
  | { type: 'awaiting-confirmation'; pendingImport: PendingImport; reviewItems: ReviewItem[] }
  | { type: 'confirmed' }
  | { type: 'watched-start'; total: number }
  | { type: 'watched-progress'; completed: number; total: number }
  | { type: 'watched-done' }
  | { type: 'merge-review-items'; items: ReviewItem[] }
  | { type: 'remove-review-item'; key: string }

function reducer(state: EnrichmentState, action: Action): EnrichmentState {
  switch (action.type) {
    case 'start':
      return { ...initialState, phase: 'enriching-watchlist', watchlistProgress: { completed: 0, total: 0 } }
    case 'error':
      return { ...state, error: action.message }
    case 'watchlist-progress':
      return { ...state, watchlistProgress: { completed: action.completed, total: action.total } }
    case 'awaiting-confirmation':
      return {
        ...state,
        phase: 'awaiting-confirmation',
        pendingImport: action.pendingImport,
        reviewItems: [...state.reviewItems, ...action.reviewItems],
      }
    case 'confirmed':
      return { ...state, phase: 'ready', pendingImport: null }
    case 'watched-start':
      return { ...state, watchedRunning: true, watchedProgress: { completed: 0, total: action.total } }
    case 'watched-progress':
      return { ...state, watchedProgress: { completed: action.completed, total: action.total } }
    case 'watched-done':
      return { ...state, watchedRunning: false }
    case 'merge-review-items':
      return { ...state, reviewItems: [...state.reviewItems, ...action.items] }
    case 'remove-review-item':
      return { ...state, reviewItems: state.reviewItems.filter((item) => item.key !== action.key) }
    default:
      return state
  }
}

function makeKey(name: string, year: number | null): string {
  return `${name.trim().toLowerCase()}|${year ?? ''}`
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null
  const year = Number.parseInt(value, 10)
  return Number.isNaN(year) ? null : year
}

function parseRating(value: string | undefined): number | null {
  if (!value) return null
  const rating = Number.parseFloat(value)
  return Number.isNaN(rating) ? null : rating
}

interface WatchedCandidate {
  name: string
  year: number | null
  rating: number | null
  watchedOn: string | null
}

interface WatchlistCandidateRow {
  name: string
  year: number | null
  addedAt: string
  letterboxdUri: string | null
}

interface EnrichmentContextValue extends EnrichmentState {
  startImport: (userId: string, files: FileList | File[], filename: string) => Promise<void>
  confirmImport: (userId: string) => Promise<void>
  resolveReviewItem: (
    userId: string,
    item: ReviewItem,
    choice: { mediaType: 'movie' | 'tv'; id: number } | 'skip',
  ) => Promise<void>
}

const EnrichmentReactContext = createContext<EnrichmentContextValue | null>(null)

// One shared cache for the whole import run: if a film shows up in both
// watchlist.csv and the watched files (a rewatch), the second phase reuses
// the first phase's resolved film_id instead of re-querying TMDB.
async function resolveWithCache(
  cache: Map<string, string>,
  name: string,
  year: number | null,
): Promise<{ filmId: string | null; outcome: MatchOutcome | null }> {
  const cacheKey = makeKey(name, year)
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return { filmId: cached, outcome: null }

  const outcome = await resolveFilm(name, year)
  let filmId: string | null = null
  if (outcome.status === 'reused') {
    filmId = outcome.filmId
  } else if (outcome.status === 'matched') {
    await upsertFilm(outcome.film)
    filmId = outcome.film.id
  }
  if (filmId !== null) cache.set(cacheKey, filmId)
  return { filmId, outcome }
}

export function EnrichmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const runWatchedPhase = useCallback(
    async (userId: string, watchedEntries: WatchedCandidate[], cache: Map<string, string>) => {
      if (watchedEntries.length === 0) return
      dispatch({ type: 'watched-start', total: watchedEntries.length })

      const results = await asyncPool(
        5,
        watchedEntries,
        async (entry) => {
          const { filmId, outcome } = await resolveWithCache(cache, entry.name, entry.year)
          return { entry, filmId, outcome }
        },
        {
          onProgress: (completed, total) => dispatch({ type: 'watched-progress', completed, total }),
        },
      )

      const watchedRows: WatchedCsvEntry[] = []
      const newReviewItems: ReviewItem[] = []
      for (const result of results) {
        if (!result) continue
        if (result.filmId !== null) {
          watchedRows.push({ filmId: result.filmId, rating: result.entry.rating, watchedOn: result.entry.watchedOn })
        } else if (result.outcome?.status === 'unmatched') {
          newReviewItems.push({
            key: `watched-${makeKey(result.entry.name, result.entry.year)}`,
            name: result.entry.name,
            year: result.entry.year,
            candidates: result.outcome.candidates,
            destination: { type: 'watched', rating: result.entry.rating, watchedOn: result.entry.watchedOn },
          })
        }
      }

      await upsertWatchedEntries(userId, watchedRows)
      if (newReviewItems.length > 0) dispatch({ type: 'merge-review-items', items: newReviewItems })
      dispatch({ type: 'watched-done' })
    },
    [],
  )

  const startImport = useCallback(
    async (userId: string, files: FileList | File[], filename: string) => {
      dispatch({ type: 'start' })

      let parsed
      try {
        parsed = await parseLetterboxdFiles(files)
      } catch (error) {
        dispatch({ type: 'error', message: error instanceof Error ? error.message : 'Could not read that file.' })
        return
      }

      const toRow = (row: LetterboxdRow): WatchlistCandidateRow => ({
        name: row.Name,
        year: parseYear(row.Year),
        addedAt: row.Date,
        letterboxdUri: row['Letterboxd URI'] || null,
      })
      const watchlistRows = parsed.watchlist.map(toRow)

      // ratings.csv rows are merged in after watched.csv so a shared film's
      // rating wins over the ratingless watched.csv entry for the same key.
      const watchedMap = new Map<string, WatchedCandidate>()
      for (const row of parsed.watched) {
        watchedMap.set(makeKey(row.Name, parseYear(row.Year)), {
          name: row.Name,
          year: parseYear(row.Year),
          rating: null,
          watchedOn: row.Date || null,
        })
      }
      for (const row of parsed.ratings as LetterboxdRatingRow[]) {
        watchedMap.set(makeKey(row.Name, parseYear(row.Year)), {
          name: row.Name,
          year: parseYear(row.Year),
          rating: parseRating(row.Rating),
          watchedOn: row.Date || null,
        })
      }

      const cache = new Map<string, string>()

      dispatch({ type: 'watchlist-progress', completed: 0, total: watchlistRows.length })
      const watchlistResults = await asyncPool(
        5,
        watchlistRows,
        async (row) => {
          const { filmId, outcome } = await resolveWithCache(cache, row.name, row.year)
          return { row, filmId, outcome }
        },
        {
          onProgress: (completed, total) => dispatch({ type: 'watchlist-progress', completed, total }),
        },
      )

      const newEntries: WatchlistCsvEntry[] = []
      const reviewItems: ReviewItem[] = []
      const csvFilmIds = new Set<string>()

      for (const result of watchlistResults) {
        if (!result) continue
        if (result.filmId !== null) {
          csvFilmIds.add(result.filmId)
          newEntries.push({
            filmId: result.filmId,
            addedAt: result.row.addedAt,
            letterboxdUri: result.row.letterboxdUri,
          })
        } else if (result.outcome?.status === 'unmatched') {
          reviewItems.push({
            key: `watchlist-${makeKey(result.row.name, result.row.year)}`,
            name: result.row.name,
            year: result.row.year,
            candidates: result.outcome.candidates,
            destination: {
              type: 'watchlist',
              addedAt: result.row.addedAt,
              letterboxdUri: result.row.letterboxdUri,
            },
          })
        }
      }

      const diff = await computeWatchlistDiff(userId, csvFilmIds)
      // Only the genuinely new-to-the-app films count toward "new" once
      // already-on-the-list titles are excluded (computeWatchlistDiff already
      // does this, but newEntries above hasn't been filtered against it yet).
      const filteredNewEntries = newEntries.filter((entry) => diff.newFilmIds.has(entry.filmId))

      dispatch({
        type: 'awaiting-confirmation',
        pendingImport: { filename, rowsInFile: parsed.watchlist.length, newEntries: filteredNewEntries, diff },
        reviewItems,
      })

      // Kicked off now, not gated on the user confirming the watchlist diff —
      // watched-table writes are independent of that confirmation.
      void runWatchedPhase(userId, [...watchedMap.values()], cache)
    },
    [runWatchedPhase],
  )

  const confirmImport = useCallback(async (userId: string) => {
    const pending = state.pendingImport
    if (!pending) return
    await insertNewWatchlistItems(userId, pending.newEntries)
    await recordImport(userId, {
      filename: pending.filename,
      rowsInFile: pending.rowsInFile,
      added: pending.newEntries.length,
      vanished: pending.diff.missingItems.length,
    })
    dispatch({ type: 'confirmed' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingImport])

  const resolveReviewItemFn = useCallback(
    async (userId: string, item: ReviewItem, choice: { mediaType: 'movie' | 'tv'; id: number } | 'skip') => {
      if (choice === 'skip') {
        dispatch({ type: 'remove-review-item', key: item.key })
        return
      }
      const film = await resolveCandidate(choice.mediaType, choice.id)
      await upsertFilm(film)
      if (item.destination.type === 'watchlist') {
        await insertNewWatchlistItems(userId, [
          { filmId: film.id, addedAt: item.destination.addedAt, letterboxdUri: item.destination.letterboxdUri },
        ])
      } else {
        await upsertWatchedEntries(userId, [
          { filmId: film.id, rating: item.destination.rating, watchedOn: item.destination.watchedOn },
        ])
      }
      dispatch({ type: 'remove-review-item', key: item.key })
    },
    [],
  )

  return (
    <EnrichmentReactContext.Provider
      value={{ ...state, startImport, confirmImport, resolveReviewItem: resolveReviewItemFn }}
    >
      {children}
    </EnrichmentReactContext.Provider>
  )
}

export function useEnrichment(): EnrichmentContextValue {
  const ctx = useContext(EnrichmentReactContext)
  if (!ctx) throw new Error('useEnrichment must be used within EnrichmentProvider')
  return ctx
}
