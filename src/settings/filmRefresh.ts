import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabaseClient'
import { asyncPool } from '../lib/asyncPool'
import { getFilmPeopleAndPlaces, parseFilmId } from '../lib/tmdbClient'
import { saveFilmPeopleAndPlaces } from '../import/watchlistWrites'
import { DbError, describeError } from '../lib/dbError'

/**
 * Fills in top_cast, directors and countries for every film missing any of
 * them. Held at module level rather than in the Settings screen, so leaving
 * the screen doesn't stop it: it runs behind whatever you do next.
 *
 * Resumable by construction. Each film is written the moment TMDB answers,
 * and only films still missing something are picked up, so running it
 * again after a reload carries on from wherever the last run got to.
 */

export interface FilmRefreshState {
  // Null until counted, and while a count is in the air.
  missing: number | null
  running: boolean
  completed: number
  total: number
  failed: number
  // Set once a run has finished, so the screen can say how it went.
  finished: boolean
  error: string | null
  // Why the most recent film failed, when any did. One reason stands for
  // the lot: a missing column fails every film the same way.
  lastFailure: string | null
}

let state: FilmRefreshState = {
  missing: null,
  running: false,
  completed: 0,
  total: 0,
  failed: 0,
  finished: false,
  error: null,
  lastFailure: null,
}

const listeners = new Set<() => void>()

function set(patch: Partial<FilmRefreshState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useFilmRefresh(): FilmRefreshState {
  return useSyncExternalStore(subscribe, () => state)
}

// Any one of the three missing puts a film in. A film with all three —
// even as empty arrays — is skipped.
const MISSING_ANY = 'top_cast.is.null,directors.is.null,countries.is.null'
const PAGE = 1000
const CONCURRENCY = 5

export async function countFilmsMissingData(): Promise<void> {
  // A run in progress keeps its own count; a recount would fight it.
  if (state.running) return
  const { count, error } = await supabase
    .from('films')
    .select('id', { count: 'exact', head: true })
    .or(MISSING_ANY)
  if (error) {
    set({ error: `Couldn't check which films need refreshing: ${DbError.from(error).report}` })
    return
  }
  set({ missing: count ?? 0, error: null })
}

// Every id first, then the fetching. Paging while rows drop out of the
// filter underneath would skip a page's worth each time.
async function loadMissingIds(): Promise<string[]> {
  const ids: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('films')
      .select('id')
      .or(MISSING_ANY)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw DbError.from(error)
    for (const row of data ?? []) ids.push(row.id)
    if ((data ?? []).length < PAGE) return ids
  }
}

export async function startFilmRefresh(): Promise<void> {
  if (state.running) return
  set({
    running: true,
    finished: false,
    completed: 0,
    total: 0,
    failed: 0,
    error: null,
    lastFailure: null,
  })

  let ids: string[]
  try {
    ids = await loadMissingIds()
  } catch (error) {
    set({ running: false, error: `Couldn't load the films to refresh: ${describeError(error)}` })
    return
  }
  set({ total: ids.length })

  let failed = 0
  await asyncPool(
    CONCURRENCY,
    ids,
    async (filmId) => {
      const parsed = parseFilmId(filmId)
      if (!parsed) throw new Error(`Unrecognised film id ${filmId}`)
      const facts = await getFilmPeopleAndPlaces(parsed.mediaType, parsed.tmdbId)
      await saveFilmPeopleAndPlaces(filmId, facts)
    },
    {
      onProgress: (completed) => set({ completed }),
      onItemError: (filmId, _index, error) => {
        failed += 1
        set({ failed, lastFailure: `${filmId}: ${describeError(error)}` })
      },
    },
  )

  // Whatever failed is still missing, so the count after a run is simply
  // what the next run would pick up.
  set({ running: false, finished: true, missing: failed })
}
