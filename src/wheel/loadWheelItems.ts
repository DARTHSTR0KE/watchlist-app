import { supabase } from '../lib/supabaseClient'
import type { TopCastMember } from '../lib/tmdbClient'
import type { WheelItem } from './titles'

// top_cast is jsonb, so it arrives as unknown-shaped Json. Anything that
// isn't the array we wrote is treated as absent rather than trusted.
function toTopCast(value: unknown): TopCastMember[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return []
    const { name, profile_path: profilePath } = entry as Record<string, unknown>
    if (typeof name !== 'string') return []
    return [{ name, profile_path: typeof profilePath === 'string' ? profilePath : null }]
  })
}

// Loads every watchlist item for the wheel — no on_wheel filter, since
// removal is now session-only (in-memory) and never persisted.
export async function loadWheelItems(userId: string): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select(
      'film_id, added_at, films(title, poster_path, backdrop_path, year, runtime, genres, vote_average, overview, media_type, original_language, trailer_key, top_cast)',
    )
    .eq('user_id', userId)
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.films !== null)
    .map((row) => {
      const film = row.films!
      return {
        id: row.film_id,
        title: film.title,
        posterPath: film.poster_path,
        backdropPath: film.backdrop_path,
        year: film.year ?? 0,
        runtimeMinutes: film.runtime ?? 0,
        genres: film.genres ?? [],
        rating: film.vote_average ?? 0,
        synopsis: film.overview ?? '',
        trailerKey: film.trailer_key,
        topCast: toTopCast(film.top_cast),
        watchedOn: null,
        myRating: null,
        partnerRating: null,
        mediaType: film.media_type,
        originalLanguage: film.original_language,
        addedAt: row.added_at,
      } satisfies WheelItem
    })
}

// Which of this user's films are already watched, for the exclude toggle.
export async function loadWatchedFilmIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('watched').select('film_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.film_id))
}

// The same film columns the wheel needs, shared by every source.
const FILM_COLUMNS =
  'title, poster_path, backdrop_path, year, runtime, genres, vote_average, overview, media_type, original_language, trailer_key, top_cast'

interface WatchedRow {
  film_id: string
  rating: number | null
  watched_on: string | null
  films: {
    title: string
    poster_path: string | null
    backdrop_path: string | null
    year: number | null
    runtime: number | null
    genres: string[] | null
    vote_average: number | null
    overview: string | null
    media_type: 'movie' | 'tv'
    original_language: string | null
    trailer_key: string | null
    top_cast: unknown
  } | null
}

function toWheelItem(row: WatchedRow, partnerRating: number | null): WheelItem {
  const film = row.films!
  return {
    id: row.film_id,
    title: film.title,
    posterPath: film.poster_path,
    backdropPath: film.backdrop_path,
    year: film.year ?? 0,
    runtimeMinutes: film.runtime ?? 0,
    genres: film.genres ?? [],
    rating: film.vote_average ?? 0,
    synopsis: film.overview ?? '',
    mediaType: film.media_type,
    originalLanguage: film.original_language,
    // Age-weighting works off this, so a watched film's "age" is how long
    // ago it was seen rather than when it joined a list.
    addedAt: row.watched_on,
    trailerKey: film.trailer_key,
    topCast: toTopCast(film.top_cast),
    watchedOn: row.watched_on,
    myRating: row.rating,
    partnerRating,
  }
}

// The rewatch pool: everything this user has already seen.
export async function loadRewatchItems(userId: string): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('watched')
    .select(`film_id, rating, watched_on, films(${FILM_COLUMNS})`)
    .eq('user_id', userId)
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.films !== null)
    .map((row) => toWheelItem(row as WatchedRow, null))
}

// Whoever this user is paired with, or null if the profile has no partner.
export async function loadPartnerId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.partner_id ?? null
}

// Films both people have rated at all, each carrying both scores. The
// threshold is applied as a filter rather than here, so moving it updates
// the count without another round trip.
export async function loadBothRatedItems(userId: string, partnerId: string): Promise<WheelItem[]> {
  const [mine, theirs] = await Promise.all([
    supabase
      .from('watched')
      .select(`film_id, rating, watched_on, films(${FILM_COLUMNS})`)
      .eq('user_id', userId)
      .not('rating', 'is', null),
    supabase.from('watched').select('film_id, rating').eq('user_id', partnerId).not('rating', 'is', null),
  ])
  if (mine.error) throw mine.error
  if (theirs.error) throw theirs.error

  const partnerRatings = new Map<string, number>()
  for (const row of theirs.data ?? []) {
    if (row.rating !== null) partnerRatings.set(row.film_id, row.rating)
  }

  return (mine.data ?? [])
    .filter((row) => row.films !== null && partnerRatings.has(row.film_id))
    .map((row) => toWheelItem(row as WatchedRow, partnerRatings.get(row.film_id) ?? null))
}
