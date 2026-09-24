import { supabase } from '../lib/supabaseClient'
import { logEvent } from '../events/events'
import { asyncPool } from '../lib/asyncPool'
import { buildFilmId } from '../lib/tmdbClient'
import type { FilmPeopleAndPlaces, NormalizedFilm, TopCastMember } from '../lib/tmdbClient'
import { resolveCandidate } from './matching'

export async function upsertFilm(film: NormalizedFilm): Promise<void> {
  const { error } = await supabase.from('films').upsert(
    {
      id: film.id,
      media_type: film.media_type,
      title: film.title,
      year: film.year,
      runtime: film.runtime,
      overview: film.overview,
      poster_path: film.poster_path,
      backdrop_path: film.backdrop_path,
      original_language: film.original_language,
      genres: film.genres,
      vote_average: film.vote_average,
      trailer_key: film.trailer_key,
      top_cast: film.top_cast,
      directors: film.directors,
      countries: film.countries,
      enriched_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

// Fills in top_cast for a film enriched before the column existed. Writes
// an empty array when TMDB lists no cast, so a film with none isn't looked
// up again on every open.
export async function saveTopCast(filmId: string, cast: TopCastMember[]): Promise<void> {
  const { error } = await supabase.from('films').update({ top_cast: cast }).eq('id', filmId)
  if (error) throw error
}

// The cast, directors and countries for a film stored before import
// captured them. Empty arrays are written as they come: a film TMDB lists
// no director for is answered, not missing, and isn't fetched again.
export async function saveFilmPeopleAndPlaces(
  filmId: string,
  facts: FilmPeopleAndPlaces,
): Promise<void> {
  const { error } = await supabase
    .from('films')
    .update({ top_cast: facts.top_cast, directors: facts.directors, countries: facts.countries })
    .eq('id', filmId)
  if (error) throw error
}

// For a film already in the films table — accepting a recommendation, say.
// Source is 'manual' so a later Letterboxd re-import doesn't ask about it.
export async function addExistingFilmToWatchlist(
  userId: string,
  filmId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('watchlist_items').insert({
    user_id: userId,
    film_id: filmId,
    source: 'manual',
    added_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return { error: 'Already on your watchlist.' }
    return { error: error.message }
  }
  return { error: null }
}

/**
 * Which of these films the table already holds. A prolific actor's page
 * lists well over a hundred credits, and re-fetching one that is already
 * stored would be work for nothing.
 */
export async function findStoredFilmIds(filmIds: string[]): Promise<Set<string>> {
  if (filmIds.length === 0) return new Set()
  const found = new Set<string>()
  const BATCH = 200
  for (let i = 0; i < filmIds.length; i += BATCH) {
    const { data, error } = await supabase
      .from('films')
      .select('id')
      .in('id', filmIds.slice(i, i + BATCH))
    if (error) throw error
    for (const row of data ?? []) found.add(row.id)
  }
  return found
}

// Enriches from TMDB only when the film isn't stored already. Returns the
// composite id either way, so callers don't care which happened.
export async function ensureFilmStored(
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<string> {
  const filmId = buildFilmId(mediaType, tmdbId)
  const stored = await findStoredFilmIds([filmId])
  if (stored.has(filmId)) return filmId

  const film = await resolveCandidate(mediaType, tmdbId)
  await upsertFilm(film)
  return film.id
}

// Which films are on this user's watchlist, so a filmography can show what
// is already theirs. Ids only — nothing here needs the rest of the row.
export async function loadWatchlistFilmIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('film_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.film_id))
}

export async function hasWatchlistItems(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('watchlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return (count ?? 0) > 0
}

// Distinguishes "nothing has ever been imported" from "the list has been
// worked through", which look identical from watchlist_items alone.
export async function hasWatchedItems(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('watched')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return (count ?? 0) > 0
}

export interface WatchlistDiff {
  newFilmIds: Set<string>
  missingItems: { watchlistItemId: string; filmId: string; title: string; posterPath: string | null }[]
  unchangedCount: number
  // CSV films this user has already watched. Kept out of the watchlist so a
  // re-import can't resurrect them, but surfaced rather than dropped.
  alreadyWatchedFilmIds: Set<string>
}

const WATCHED_LOOKUP_BATCH = 200

async function findWatchedFilmIds(userId: string, filmIds: string[]): Promise<Set<string>> {
  const watched = new Set<string>()
  for (let i = 0; i < filmIds.length; i += WATCHED_LOOKUP_BATCH) {
    const batch = filmIds.slice(i, i + WATCHED_LOOKUP_BATCH)
    const { data, error } = await supabase
      .from('watched')
      .select('film_id')
      .eq('user_id', userId)
      .in('film_id', batch)
    if (error) throw error
    for (const row of data ?? []) watched.add(row.film_id)
  }
  return watched
}

// Compares the CSV's film set against this user's existing letterboxd-
// sourced watchlist_items. Manual-source items are never inspected here —
// they're not the file's business, per spec.
export async function computeWatchlistDiff(userId: string, csvFilmIds: Set<string>): Promise<WatchlistDiff> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('id, film_id, source, films(title, poster_path)')
    .eq('user_id', userId)
  if (error) throw error

  const existingLetterboxd = (data ?? []).filter((row) => row.source === 'letterboxd')
  const existingFilmIds = new Set(existingLetterboxd.map((row) => row.film_id))

  const newFilmIds = new Set([...csvFilmIds].filter((id) => !existingFilmIds.has(id)))
  const missingItems = existingLetterboxd
    .filter((row) => !csvFilmIds.has(row.film_id))
    .map((row) => ({
      watchlistItemId: row.id,
      filmId: row.film_id,
      title: row.films?.title ?? 'Unknown',
      posterPath: row.films?.poster_path ?? null,
    }))
  const unchangedCount = existingLetterboxd.length - missingItems.length
  const alreadyWatchedFilmIds = await findWatchedFilmIds(userId, [...newFilmIds])

  return { newFilmIds, missingItems, unchangedCount, alreadyWatchedFilmIds }
}

/**
 * Letterboxd URIs land on films, not on watchlist_items. The URI identifies
 * the film itself, and the watchlist row is deleted the moment "Watch this"
 * is tapped — which is the one moment the link is wanted.
 *
 * Only films that don't already have one are written, so a re-import of the
 * same export costs nothing.
 */
export async function saveLetterboxdUris(uriByFilmId: Map<string, string>): Promise<void> {
  const ids = [...uriByFilmId.keys()]
  if (ids.length === 0) return

  const needing: string[] = []
  for (let start = 0; start < ids.length; start += 200) {
    const { data, error } = await supabase
      .from('films')
      .select('id')
      .in('id', ids.slice(start, start + 200))
      .is('letterboxd_uri', null)
    if (error) throw error
    for (const row of data ?? []) needing.push(row.id)
  }

  await asyncPool(5, needing, async (filmId) => {
    const uri = uriByFilmId.get(filmId)
    if (!uri) return
    await supabase.from('films').update({ letterboxd_uri: uri }).eq('id', filmId)
  })
}

export interface WatchlistCsvEntry {
  filmId: string
  addedAt: string
  letterboxdUri: string | null
  // Carried from the CSV row so a blocked entry can be exported back to
  // Letterboxd without another round trip for its title.
  title: string
  year: number | null
}

export async function insertNewWatchlistItems(userId: string, entries: WatchlistCsvEntry[]): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((entry) => ({
    user_id: userId,
    film_id: entry.filmId,
    source: 'letterboxd',
    added_at: entry.addedAt,
  }))
  const { error } = await supabase.from('watchlist_items').insert(rows)
  if (error) throw error
}

// Built from local date parts on purpose: toISOString() is UTC, which
// returns yesterday's date for anyone east of Greenwich in the early hours.
function todayLocalDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Committing to a film: it leaves this user's watchlist and lands in
// watched, dated today, with together left null — nobody has been asked
// yet, and null is not the same as "on my own". The watchlist row's
// added_at is carried across first, so if this turns out not to have been
// watched the film can go back with the age it actually had. Only ever
// touches this user's own rows.
export async function watchFilmNow(userId: string, filmId: string): Promise<void> {
  const { data: existingWatchlist, error: watchlistReadError } = await supabase
    .from('watchlist_items')
    .select('added_at')
    .eq('user_id', userId)
    .eq('film_id', filmId)
    .maybeSingle()
  if (watchlistReadError) throw watchlistReadError

  const { error: upsertError } = await supabase.from('watched').upsert(
    {
      user_id: userId,
      film_id: filmId,
      source: 'app',
      watched_on: todayLocalDate(),
      together: null,
      prev_added_at: existingWatchlist?.added_at ?? null,
    },
    { onConflict: 'user_id,film_id' },
  )
  if (upsertError) throw upsertError

  const { error: deleteError } = await supabase
    .from('watchlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('film_id', filmId)
  if (deleteError) throw deleteError
  logEvent('watch_started', { filmId })
}

export async function markMissingAsWatched(userId: string, watchlistItemIds: string[], filmIds: string[]): Promise<void> {
  if (filmIds.length === 0) return
  const watchedRows = filmIds.map((filmId) => ({
    user_id: userId,
    film_id: filmId,
    source: 'letterboxd',
    together: false,
  }))
  const { error: watchedError } = await supabase
    .from('watched')
    .upsert(watchedRows, { onConflict: 'user_id,film_id' })
  if (watchedError) throw watchedError

  const { error: deleteError } = await supabase.from('watchlist_items').delete().in('id', watchlistItemIds)
  if (deleteError) throw deleteError
}

export async function removeMissingItems(watchlistItemIds: string[]): Promise<void> {
  if (watchlistItemIds.length === 0) return
  const { error } = await supabase.from('watchlist_items').delete().in('id', watchlistItemIds)
  if (error) throw error
}

export async function keepMissingItemsManually(watchlistItemIds: string[]): Promise<void> {
  if (watchlistItemIds.length === 0) return
  const { error } = await supabase.from('watchlist_items').update({ source: 'manual' }).in('id', watchlistItemIds)
  if (error) throw error
}

export interface WatchedCsvEntry {
  filmId: string
  rating: number | null
  watchedOn: string | null
}

const WATCHED_BATCH_SIZE = 200

// Merges ratings.csv + watched.csv rows into the watched table. Never
// touches a row whose existing source isn't 'letterboxd' — an in-app or
// otherwise manually-recorded watch isn't the file's business either.
export async function upsertWatchedEntries(userId: string, entries: WatchedCsvEntry[]): Promise<void> {
  if (entries.length === 0) return

  const filmIds = entries.map((entry) => entry.filmId)
  const nonLetterboxdFilmIds = new Set<string>()

  for (let i = 0; i < filmIds.length; i += WATCHED_BATCH_SIZE) {
    const idBatch = filmIds.slice(i, i + WATCHED_BATCH_SIZE)
    const { data, error } = await supabase
      .from('watched')
      .select('film_id, source')
      .eq('user_id', userId)
      .in('film_id', idBatch)
    if (error) throw error
    for (const row of data ?? []) {
      if (row.source !== 'letterboxd') nonLetterboxdFilmIds.add(row.film_id)
    }
  }

  const safeEntries = entries.filter((entry) => !nonLetterboxdFilmIds.has(entry.filmId))
  const rows = safeEntries.map((entry) => ({
    user_id: userId,
    film_id: entry.filmId,
    rating: entry.rating,
    watched_on: entry.watchedOn,
    source: 'letterboxd',
    // Explicit: a null here would put every imported film into the
    // "did you watch this together?" queue.
    together: false,
  }))

  for (let i = 0; i < rows.length; i += WATCHED_BATCH_SIZE) {
    const batch = rows.slice(i, i + WATCHED_BATCH_SIZE)
    const { error } = await supabase.from('watched').upsert(batch, { onConflict: 'user_id,film_id' })
    if (error) throw error
  }
}

export async function recordImport(
  userId: string,
  params: { filename: string; rowsInFile: number; added: number; vanished: number },
): Promise<void> {
  const { error } = await supabase.from('imports').insert({
    user_id: userId,
    filename: params.filename,
    rows_in_file: params.rowsInFile,
    added: params.added,
    vanished: params.vanished,
  })
  if (error) throw error
  // The counts live on the imports row; the event only places it in time.
  logEvent('import_run')
}

// What is on the list and when it last changed, so importing again is a
// decision rather than a guess.
export interface WatchlistSummary {
  count: number
  lastImportedAt: string | null
}

export async function loadWatchlistSummary(userId: string): Promise<WatchlistSummary> {
  const [{ count, error }, lastImportedAt] = await Promise.all([
    supabase
      .from('watchlist_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    getLastImportDate(userId).catch(() => null),
  ])
  if (error) throw error
  return { count: count ?? 0, lastImportedAt }
}

export async function getLastImportDate(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('imports')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at ?? null
}

export interface WatchlistGridItem {
  itemId: string
  filmId: string
  title: string
  posterPath: string | null
  addedAt: string | null
}

export async function getWatchlistGrid(userId: string): Promise<WatchlistGridItem[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('id, film_id, added_at, films(title, poster_path)')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    itemId: row.id,
    filmId: row.film_id,
    title: row.films?.title ?? 'Unknown',
    posterPath: row.films?.poster_path ?? null,
    addedAt: row.added_at,
  }))
}

export async function addManualWatchlistItem(userId: string, film: NormalizedFilm): Promise<{ error: string | null }> {
  await upsertFilm(film)
  const { error } = await supabase.from('watchlist_items').insert({
    user_id: userId,
    film_id: film.id,
    source: 'manual',
    added_at: new Date().toISOString(),
  })
  if (error) {
    if (error.code === '23505') return { error: 'Already on your watchlist.' }
    return { error: error.message }
  }
  return { error: null }
}
