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
  // Filterable properties, and how long the title has been waiting — the
  // draw weights by that.
  mediaType: 'movie' | 'tv'
  originalLanguage: string | null
  addedAt: string | null
}
