import type { TopCastMember } from '../lib/tmdbClient'

export interface WheelItem {
  id: string
  title: string
  posterPath: string | null
  backdropPath: string | null
  year: number
  runtimeMinutes: number
  genres: string[]
  rating: number
  synopsis: string
  trailerKey: string | null
  // null means "never fetched" and triggers a lazy backfill when the modal
  // opens; [] means TMDB genuinely lists nobody.
  topCast: TopCastMember[] | null
  // Filterable properties, and how long the title has been waiting — the
  // draw weights by that. For the watched sources addedAt carries
  // watched_on instead, so "waiting longest" reads as "seen longest ago".
  mediaType: 'movie' | 'tv'
  originalLanguage: string | null
  addedAt: string | null
  // Only populated by the watched sources. myRating and partnerRating are
  // the 0.5-5 Letterboxd scale; null means seen but never scored.
  watchedOn: string | null
  myRating: number | null
  partnerRating: number | null
}
