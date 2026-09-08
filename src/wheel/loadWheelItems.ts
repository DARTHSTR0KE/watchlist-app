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
