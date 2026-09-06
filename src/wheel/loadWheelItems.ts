import { supabase } from '../lib/supabaseClient'
import type { WheelItem } from './titles'

export async function loadWheelItems(userId: string): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('film_id, films(title, poster_path, backdrop_path, year, runtime, genres, vote_average, overview)')
    .eq('user_id', userId)
    .eq('on_wheel', true)
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.films !== null)
    .map((row) => {
      const film = row.films!
      return {
        id: String(row.film_id),
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

export async function setOnWheel(userId: string, filmId: number, onWheel: boolean): Promise<void> {
  const { error } = await supabase
    .from('watchlist_items')
    .update({ on_wheel: onWheel })
    .eq('user_id', userId)
    .eq('film_id', filmId)
  if (error) throw error
}
