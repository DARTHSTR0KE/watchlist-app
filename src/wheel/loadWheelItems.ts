import { supabase } from '../lib/supabaseClient'
import type { WheelItem } from './titles'

// Loads every watchlist item for the wheel — no on_wheel filter, since
// removal is now session-only (in-memory) and never persisted.
export async function loadWheelItems(userId: string): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('film_id, films(title, poster_path, backdrop_path, year, runtime, genres, vote_average, overview)')
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
      } satisfies WheelItem
    })
}
