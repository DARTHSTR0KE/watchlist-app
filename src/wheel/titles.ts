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
}
