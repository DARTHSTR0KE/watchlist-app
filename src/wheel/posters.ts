// w342 only, per product decision — never w500 or larger.
const TMDB_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w342'

// Backdrops render heavily blurred behind the result modal, so a mid-size
// image is plenty — no need for the largest TMDB offers.
const TMDB_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w780'

export function buildPosterUrl(posterPath: string | null | undefined): string | null {
  if (!posterPath) return null
  return `${TMDB_POSTER_BASE_URL}${posterPath}`
}

// The page background is blurred past recognition, so the smallest size
// TMDB offers is plenty — and loads far faster on a phone.
const TMDB_PAGE_BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w300'

export function buildBackdropUrl(backdropPath: string | null | undefined): string | null {
  if (!backdropPath) return null
  return `${TMDB_BACKDROP_BASE_URL}${backdropPath}`
}

export function buildPageBackdropUrl(backdropPath: string | null | undefined): string | null {
  if (!backdropPath) return null
  return `${TMDB_PAGE_BACKDROP_BASE_URL}${backdropPath}`
}

// Cast portraits render at ~56px in a scrolling row, so the smallest
// profile size TMDB offers is already more than enough.
const TMDB_PROFILE_BASE_URL = 'https://image.tmdb.org/t/p/w185'

export function buildProfileUrl(profilePath: string | null | undefined): string | null {
  if (!profilePath) return null
  return `${TMDB_PROFILE_BASE_URL}${profilePath}`
}
