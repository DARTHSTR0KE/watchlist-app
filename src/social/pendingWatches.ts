import { supabase } from '../lib/supabaseClient'
import { logEvent } from '../events/events'

/**
 * Watching a film asks nothing at the time — you are about to start it.
 * The question waits here until the next time the app opens.
 *
 * `together` is three-valued and the three mean different things: true is
 * "with them", false is "on my own", and null is "nobody has been asked".
 * Nothing here may collapse null into false.
 */

export interface PendingWatch {
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  backdropPath: string | null
  watchedOn: string | null
  // The added_at the film had on the watchlist before it was watched, kept
  // so "didn't watch it" can put it back with the age it really had.
  prevAddedAt: string | null
  // Read from films, not from the watchlist row — that row is already gone
  // by the time this question is asked.
  letterboxdUri: string | null
}

interface PendingRow {
  film_id: string
  watched_on: string | null
  prev_added_at: string | null
  films: {
    title: string
    year: number | null
    poster_path: string | null
    backdrop_path: string | null
    letterboxd_uri: string | null
  } | null
}

// Oldest first, so the queue works through in the order things happened.
export async function loadPendingWatches(userId: string): Promise<PendingWatch[]> {
  const { data, error } = await supabase
    .from('watched')
    .select(
      'film_id, watched_on, prev_added_at, films(title, year, poster_path, backdrop_path, letterboxd_uri)',
    )
    .eq('user_id', userId)
    .is('together', null)
    .order('watched_on', { ascending: true })
  if (error) throw error

  return ((data ?? []) as unknown as PendingRow[])
    .filter((row) => row.films !== null)
    .map((row) => ({
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      backdropPath: row.films!.backdrop_path,
      watchedOn: row.watched_on,
      prevAddedAt: row.prev_added_at,
      letterboxdUri: row.films!.letterboxd_uri,
    }))
}

// Answers the question. Only this user's own row — the other person
// answers for themselves.
export async function answerWatch(
  userId: string,
  filmId: string,
  together: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('watched')
    .update({ together })
    .eq('user_id', userId)
    .eq('film_id', filmId)
  if (error) throw error
  logEvent(together ? 'watched_together' : 'watched_alone', { filmId })
}

/**
 * "Didn't watch it after all": the watched row goes and the film returns
 * to the watchlist carrying prev_added_at, not today. The wheel weights by
 * how long a title has been listed, so restoring it as new would quietly
 * make it the least likely thing to come up.
 */
export async function undoWatch(userId: string, pending: PendingWatch): Promise<void> {
  const { error: insertError } = await supabase.from('watchlist_items').insert({
    user_id: userId,
    film_id: pending.filmId,
    source: 'manual',
    added_at: pending.prevAddedAt ?? new Date().toISOString(),
  })
  // Already back on the list is not a failure; the watched row still goes.
  if (insertError && insertError.code !== '23505') throw insertError

  const { error: deleteError } = await supabase
    .from('watched')
    .delete()
    .eq('user_id', userId)
    .eq('film_id', pending.filmId)
  if (deleteError) throw deleteError
  logEvent('watch_abandoned', { filmId: pending.filmId })
}

export interface WatchedFilm {
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  watchedOn: string | null
  // True when either of us said we watched it together. One grid with a
  // marker reads better than splitting the same films across two tabs.
  together: boolean
}

// A Letterboxd history runs to thousands; the screen shows the recent end.
export const WATCHED_LIMIT = 300

/**
 * Watched together is one fact about a film, not two opinions about it.
 * The policy lets either of us read any row where together is true, so a
 * single query with no user filter returns every such row from both
 * people — we both run it and both get the same answer.
 *
 * If we disagree, together wins: one of us remembers sitting there.
 */
export async function loadTogetherFilmIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('watched').select('film_id').eq('together', true)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.film_id))
}

interface WatchedRow {
  film_id: string
  user_id?: string
  watched_on: string | null
  together: boolean | null
  films: { title: string; year: number | null; poster_path: string | null } | null
}

/**
 * The together half, as films rather than ids. Deliberately its own query:
 * picking these out of the per-person reads meant a film only appeared if
 * somebody's row for it happened to fall inside their newest WATCHED_LIMIT,
 * so whoever had the longer history lost their own together films from the
 * list. Four rows read as four for one of us and one for the other.
 *
 * No user filter, so there is no "my side" and "their side" to get wrong,
 * and the same LIMIT applies to the same rows for both of us.
 */
async function fetchTogetherWatched(): Promise<WatchedRow[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, user_id, watched_on, together, films(title, year, poster_path)')
    .eq('together', true)
    .order('watched_on', { ascending: false, nullsFirst: false })
    .limit(WATCHED_LIMIT)
  if (error) throw error
  return ((data ?? []) as unknown as WatchedRow[]).filter((row) => row.films !== null)
}

// Null rather than a guess when the count can't be read: a wrong total is
// worse than falling back to the length of the list.
async function countWatched(userId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from('watched')
    .select('film_id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) return null
  return count
}

// My own history, newest first. Only ever used for the alone half now.
async function fetchWatched(userId: string): Promise<WatchedRow[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, watched_on, together, films(title, year, poster_path)')
    .eq('user_id', userId)
    .order('watched_on', { ascending: false, nullsFirst: false })
    .limit(WATCHED_LIMIT)
  if (error) throw error
  return ((data ?? []) as unknown as WatchedRow[]).filter((row) => row.films !== null)
}

export interface WatchedSplit {
  // The shared fact, identical for both of us.
  together: WatchedFilm[]
  // Only ever my own rows: a film watched alone is private to whoever
  // watched it, so this can never contain theirs. Capped at WATCHED_LIMIT
  // — the screen shows the recent end of a long history.
  alone: WatchedFilm[]
  // How many there really are. The count shown has to be a fact about the
  // history and not a fact about the cap, or a 305-film history reads as
  // exactly 300 and looks like a coincidence nobody can explain.
  aloneTotal: number
}

function toFilm(row: WatchedRow, together: boolean): WatchedFilm {
  return {
    filmId: row.film_id,
    title: row.films!.title,
    year: row.films!.year,
    posterPath: row.films!.poster_path,
    watchedOn: row.watched_on,
    together,
  }
}

const newestFirst = (a: WatchedFilm, b: WatchedFilm) =>
  (b.watchedOn ?? '').localeCompare(a.watchedOn ?? '')

/**
 * A film is in the together half when ANY row for it says together, whoever
 * owns that row — which is a question about the film, not about whose list
 * it came from. There is no partner id here on purpose: the moment this
 * reasons about "my rows" and "their rows" as two sets to merge, the two of
 * us start seeing different answers.
 *
 * Deduplicated by film_id throughout, and the two halves are disjoint, so
 * alone is exactly my own films minus the resolved together set.
 */
export async function loadWatchedSplit(userId: string): Promise<WatchedSplit> {
  const [togetherRows, mine, mineCount] = await Promise.all([
    fetchTogetherWatched(),
    fetchWatched(userId),
    countWatched(userId),
  ])

  const together = new Map<string, WatchedFilm>()
  for (const row of togetherRows) {
    const existing = together.get(row.film_id)
    if (!existing) {
      together.set(row.film_id, toFilm(row, true))
      continue
    }
    // Two rows for one film: the later sitting is the one to show.
    if ((row.watched_on ?? '') > (existing.watchedOn ?? '')) existing.watchedOn = row.watched_on
  }

  const alone = new Map<string, WatchedFilm>()
  for (const row of mine) {
    if (together.has(row.film_id) || alone.has(row.film_id)) continue
    alone.set(row.film_id, toFilm(row, false))
  }

  // Everything of mine that isn't in the together set, counted rather than
  // listed, so the cap on the grid never becomes the number on the screen.
  const myTogetherRows = togetherRows.filter((row) => row.user_id === userId).length
  const aloneTotal = mineCount === null ? alone.size : Math.max(alone.size, mineCount - myTogetherRows)

  return {
    together: [...together.values()].sort(newestFirst),
    alone: [...alone.values()].sort(newestFirst),
    aloneTotal,
  }
}
