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

// Everything either of us has watched, newest first, one entry per film.
// A film counts as together if either of us said so — null is unanswered,
// which is not the same as no.
export async function loadWatchedFilms(
  userId: string,
  partnerId: string | null,
): Promise<WatchedFilm[]> {
  const [mine, theirs] = await Promise.all([
    fetchWatched(userId),
    partnerId ? fetchWatched(partnerId) : Promise.resolve([] as WatchedRow[]),
  ])

  const byFilm = new Map<string, WatchedFilm>()
  for (const row of [...mine, ...theirs]) {
    const existing = byFilm.get(row.film_id)
    if (existing) {
      if ((row.watched_on ?? '') > (existing.watchedOn ?? '')) existing.watchedOn = row.watched_on
      existing.together = existing.together || row.together === true
      continue
    }
    byFilm.set(row.film_id, {
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      watchedOn: row.watched_on,
      together: row.together === true,
    })
  }

  return [...byFilm.values()].sort((a, b) => (b.watchedOn ?? '').localeCompare(a.watchedOn ?? ''))
}
