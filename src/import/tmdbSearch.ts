import { searchMovies, searchTv, yearFromDate } from '../lib/tmdbClient'

export interface ManualResult {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  year: number | null
  posterPath: string | null
}

// Films and shows for one query, in that order. Shared by the import
// screen and the custom wheel editor, which search TMDB identically.
export async function searchTmdb(query: string): Promise<ManualResult[]> {
  const [movies, tv] = await Promise.all([searchMovies(query), searchTv(query)])
  const movieResults: ManualResult[] = movies.slice(0, 10).map((r) => ({
    id: r.id,
    mediaType: 'movie',
    title: r.title,
    year: yearFromDate(r.release_date),
    posterPath: r.poster_path,
  }))
  const tvResults: ManualResult[] = tv.slice(0, 10).map((r) => ({
    id: r.id,
    mediaType: 'tv',
    title: r.name,
    year: yearFromDate(r.first_air_date),
    posterPath: r.poster_path,
  }))
  return [...movieResults, ...tvResults]
}
