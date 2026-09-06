import { supabase } from '../lib/supabaseClient'
import type { NormalizedFilm } from '../lib/tmdbClient'

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
      enriched_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

export async function hasWatchlistItems(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('watchlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return (count ?? 0) > 0
}

export interface WatchlistDiff {
  newFilmIds: Set<number>
  missingItems: { watchlistItemId: string; filmId: number; title: string; posterPath: string | null }[]
  unchangedCount: number
}

// Compares the CSV's film set against this user's existing letterboxd-
// sourced watchlist_items. Manual-source items are never inspected here —
// they're not the file's business, per spec.
export async function computeWatchlistDiff(userId: string, csvFilmIds: Set<number>): Promise<WatchlistDiff> {
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

  return { newFilmIds, missingItems, unchangedCount }
}

export interface WatchlistCsvEntry {
  filmId: number
  addedAt: string
  letterboxdUri: string | null
}

export async function insertNewWatchlistItems(userId: string, entries: WatchlistCsvEntry[]): Promise<void> {
  if (entries.length === 0) return
  const rows = entries.map((entry) => ({
    user_id: userId,
    film_id: entry.filmId,
    source: 'letterboxd',
    letterboxd_uri: entry.letterboxdUri,
    added_at: entry.addedAt,
    on_wheel: true,
  }))
  const { error } = await supabase.from('watchlist_items').insert(rows)
  if (error) throw error
}

export async function markMissingAsWatched(userId: string, watchlistItemIds: string[], filmIds: number[]): Promise<void> {
  if (filmIds.length === 0) return
  const watchedRows = filmIds.map((filmId) => ({ user_id: userId, film_id: filmId, source: 'letterboxd' }))
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
  filmId: number
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
  const nonLetterboxdFilmIds = new Set<number>()

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
  filmId: number
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
    on_wheel: true,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Already on your watchlist.' }
    return { error: error.message }
  }
  return { error: null }
}
