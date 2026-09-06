// w342 only, per product decision — never w500 or larger.
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342'

// Backdrops render heavily blurred behind the result modal, so a mid-size
// image is plenty — no need for the largest TMDB offers.
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w780'

export function buildPosterUrl(posterPath: string | null | undefined): string | null {
  if (!posterPath) return null
  return `${TMDB_POSTER_BASE_URL}${posterPath}`
}

export function buildBackdropUrl(backdropPath: string | null | undefined): string | null {
  if (!backdropPath) return null
  return `${TMDB_BACKDROP_BASE_URL}${backdropPath}`
}
