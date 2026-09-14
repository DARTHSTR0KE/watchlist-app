import { supabase } from '../lib/supabaseClient'

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
  } | null
}

// Oldest first, so the queue works through in the order things happened.
export async function loadPendingWatches(userId: string): Promise<PendingWatch[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, watched_on, prev_added_at, films(title, year, poster_path, backdrop_path)')
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
 * people — we both run it and both get the same answer. Merging two
 * per-person results would leave each side counting mostly its own, which
 * is how the same films came to read 3 for one of us and 1 for the other.
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
  watched_on: string | null
  together: boolean | null
  films: { title: string; year: number | null; poster_path: string | null } | null
}

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
  // watched it, so this can never contain theirs.
  alone: WatchedFilm[]
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

/**
 * Everything visible to me, split by the shared fact. Rows come from two
 * reads: my own history, and every together row from either of us — the
 * second is what makes the together half the same for both people.
 */
export async function loadWatchedSplit(
  userId: string,
  partnerId: string | null,
): Promise<WatchedSplit> {
  const [mine, theirs, togetherIds] = await Promise.all([
    fetchWatched(userId),
    partnerId ? fetchWatched(partnerId) : Promise.resolve([] as WatchedRow[]),
    loadTogetherFilmIds(),
  ])

  const byFilm = new Map<string, WatchedFilm>()
  for (const row of [...mine, ...theirs]) {
    const shared = togetherIds.has(row.film_id)
    const existing = byFilm.get(row.film_id)
    if (existing) {
      if ((row.watched_on ?? '') > (existing.watchedOn ?? '')) existing.watchedOn = row.watched_on
      continue
    }
    byFilm.set(row.film_id, toFilm(row, shared))
  }

  const newestFirst = (a: WatchedFilm, b: WatchedFilm) =>
    (b.watchedOn ?? '').localeCompare(a.watchedOn ?? '')
  const all = [...byFilm.values()]
  return {
    together: all.filter((film) => film.together).sort(newestFirst),
    alone: all.filter((film) => !film.together).sort(newestFirst),
  }
}
