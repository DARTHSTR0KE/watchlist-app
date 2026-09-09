import { supabase } from '../lib/supabaseClient'

export interface WatchLogEntry {
  watchedOn: string
  together: boolean
  pickedBy: string | null
  rating: number | null
}

// What is already recorded for a film, so the log form can start from it
// rather than blanking a rating given the last time round — watched has a
// unique row per user and film, so logging a rewatch overwrites.
export async function loadExistingLog(
  userId: string,
  filmId: string,
): Promise<WatchLogEntry | null> {
  const { data, error } = await supabase
    .from('watched')
    .select('rating, watched_on, together, picked_by')
    .eq('user_id', userId)
    .eq('film_id', filmId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    watchedOn: data.watched_on ?? todayLocalDate(),
    together: data.together,
    pickedBy: data.picked_by,
    rating: data.rating,
  }
}

// Built from local date parts: toISOString() is UTC, which gives yesterday
// for anyone east of Greenwich in the early hours.
export function todayLocalDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Fills in the row "Watch this" already wrote. Only ever this user's own —
// a partner records their own watch, with their own rating.
export async function saveWatchLog(
  userId: string,
  filmId: string,
  entry: WatchLogEntry,
): Promise<void> {
  const { error } = await supabase
    .from('watched')
    .update({
      watched_on: entry.watchedOn,
      together: entry.together,
      picked_by: entry.pickedBy,
      rating: entry.rating,
      source: 'app',
    })
    .eq('user_id', userId)
    .eq('film_id', filmId)
  if (error) throw error
}

export interface PendingShare {
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  watchedOn: string | null
}

/**
 * Films the partner logged as watched together that this user has not
 * acknowledged. "Acknowledged" is their own row carrying together = true,
 * which is simply the truth about that watch — so both rating it and
 * skipping it settle the question, and neither needs a column of its own.
 */
export async function loadPendingSharedRatings(
  userId: string,
  partnerId: string,
): Promise<PendingShare[]> {
  const theirs = await supabase
    .from('watched')
    .select('film_id, watched_on, films(title, year, poster_path)')
    .eq('user_id', partnerId)
    .eq('together', true)
    .order('watched_on', { ascending: false })
  if (theirs.error) throw theirs.error

  const rows = (theirs.data ?? []).filter((row) => row.films !== null)
  if (rows.length === 0) return []

  const mine = await supabase
    .from('watched')
    .select('film_id, together')
    .eq('user_id', userId)
    .in(
      'film_id',
      rows.map((row) => row.film_id),
    )
  if (mine.error) throw mine.error

  const settled = new Set(
    (mine.data ?? []).filter((row) => row.together).map((row) => row.film_id),
  )

  return rows
    .filter((row) => !settled.has(row.film_id))
    .map((row) => ({
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      watchedOn: row.watched_on,
    }))
}

// Records this user's own side of a shared watch. A null rating still
// settles it — "we watched it, I'd rather not score it" is an answer.
// Updates rather than upserts when a row already exists, so an older
// watched_on isn't overwritten by the shared one.
export async function acknowledgeSharedWatch(
  userId: string,
  filmId: string,
  rating: number | null,
  watchedOn: string | null,
): Promise<void> {
  const { data, error: readError } = await supabase
    .from('watched')
    .select('id')
    .eq('user_id', userId)
    .eq('film_id', filmId)
    .maybeSingle()
  if (readError) throw readError

  if (data) {
    const { error } = await supabase
      .from('watched')
      .update({ together: true, rating })
      .eq('user_id', userId)
      .eq('film_id', filmId)
    if (error) throw error
    return
  }

  const { error } = await supabase.from('watched').insert({
    user_id: userId,
    film_id: filmId,
    together: true,
    rating,
    watched_on: watchedOn ?? todayLocalDate(),
    source: 'app',
  })
  if (error) throw error
}

export interface HistoryEntry {
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  myRating: number | null
  myWatchedOn: string | null
  partnerRating: number | null
  partnerWatchedOn: string | null
  together: boolean
  // Whichever of the two dates is later — what the list is ordered by.
  sortDate: string
}

// Deliberately capped: a Letterboxd history runs to thousands, and the
// screen only ever shows the recent end of it.
export const HISTORY_LIMIT = 250

interface HistoryRow {
  film_id: string
  rating: number | null
  watched_on: string | null
  together: boolean
  films: { title: string; year: number | null; poster_path: string | null } | null
}

async function loadWatchedPage(userId: string): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, rating, watched_on, together, films(title, year, poster_path)')
    .eq('user_id', userId)
    .order('watched_on', { ascending: false, nullsFirst: false })
    .limit(HISTORY_LIMIT)
  if (error) throw error
  return ((data ?? []) as unknown as HistoryRow[]).filter((row) => row.films !== null)
}

// Everything either of us has watched, newest first, carrying both scores
// wherever both exist.
export async function loadHistory(
  userId: string,
  partnerId: string | null,
): Promise<HistoryEntry[]> {
  const [mine, theirs] = await Promise.all([
    loadWatchedPage(userId),
    partnerId ? loadWatchedPage(partnerId) : Promise.resolve([] as HistoryRow[]),
  ])

  const byFilm = new Map<string, HistoryEntry>()

  for (const row of mine) {
    byFilm.set(row.film_id, {
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      myRating: row.rating,
      myWatchedOn: row.watched_on,
      partnerRating: null,
      partnerWatchedOn: null,
      together: row.together,
      sortDate: row.watched_on ?? '',
    })
  }

  for (const row of theirs) {
    const existing = byFilm.get(row.film_id)
    if (existing) {
      existing.partnerRating = row.rating
      existing.partnerWatchedOn = row.watched_on
      existing.together = existing.together || row.together
      if ((row.watched_on ?? '') > existing.sortDate) existing.sortDate = row.watched_on ?? ''
      continue
    }
    byFilm.set(row.film_id, {
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      myRating: null,
      myWatchedOn: null,
      partnerRating: row.rating,
      partnerWatchedOn: row.watched_on,
      together: row.together,
      sortDate: row.watched_on ?? '',
    })
  }

  return [...byFilm.values()].sort((a, b) => b.sortDate.localeCompare(a.sortDate))
}
