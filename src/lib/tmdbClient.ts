import { extractCountries, extractDirectors } from './filmCredits'
import type { CreditPerson, TmdbCountry, TmdbCreator, TmdbCrewMember } from './filmCredits'

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

if (!TMDB_API_KEY) {
  throw new Error('Missing VITE_TMDB_API_KEY in .env')
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status}): ${path}`)
  }
  return res.json() as Promise<T>
}

export interface TmdbMovieSearchResult {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

export interface TmdbTvSearchResult {
  id: number
  name: string
  first_air_date: string
  poster_path: string | null
}

interface TmdbSearchResponse<T> {
  results: T[]
}

export async function searchMovies(query: string, year?: number): Promise<TmdbMovieSearchResult[]> {
  const data = await tmdbFetch<TmdbSearchResponse<TmdbMovieSearchResult>>('/search/movie', {
    query,
    year,
  })
  return data.results
}

export async function searchTv(query: string, firstAirDateYear?: number): Promise<TmdbTvSearchResult[]> {
  const data = await tmdbFetch<TmdbSearchResponse<TmdbTvSearchResult>>('/search/tv', {
    query,
    first_air_date_year: firstAirDateYear,
  })
  return data.results
}

export interface TmdbPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string | null
  popularity: number
}

export async function searchPeople(query: string): Promise<TmdbPerson[]> {
  const data = await tmdbFetch<TmdbSearchResponse<TmdbPerson>>('/search/person', { query })
  return data.results
}

// One credit from a person's filmography. Enough to list it without a
// second call per film — nothing here is enriched until it is added.
export interface TmdbCredit {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
  poster_path: string | null
  popularity?: number
  job?: string
}

export interface TmdbCombinedCredits {
  cast?: TmdbCredit[]
  crew?: TmdbCredit[]
}

export async function getCombinedCredits(personId: number): Promise<TmdbCombinedCredits> {
  return tmdbFetch<TmdbCombinedCredits>(`/person/${personId}/combined_credits`, {})
}

interface TmdbGenre {
  id: number
  name: string
}

interface TmdbVideo {
  site: string
  type: string
  key: string
}

interface TmdbVideosBlock {
  videos?: { results: TmdbVideo[] }
}

interface TmdbCastMember {
  name: string
  profile_path: string | null
  order?: number
}

export interface TmdbCredits {
  cast?: TmdbCastMember[]
  crew?: TmdbCrewMember[]
}

interface TmdbCreditsBlock {
  credits?: TmdbCredits
}

export interface TmdbMovieDetails extends TmdbVideosBlock, TmdbCreditsBlock {
  id: number
  title: string
  release_date: string | null
  runtime: number | null
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  original_language: string | null
  genres: TmdbGenre[]
  vote_average: number | null
  production_countries?: TmdbCountry[]
}

export interface TmdbTvDetails extends TmdbVideosBlock, TmdbCreditsBlock {
  id: number
  name: string
  first_air_date: string | null
  episode_run_time: number[]
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  original_language: string | null
  genres: TmdbGenre[]
  vote_average: number | null
  production_countries?: TmdbCountry[]
  created_by?: TmdbCreator[]
}

export async function getMovieDetails(id: number): Promise<TmdbMovieDetails> {
  return tmdbFetch<TmdbMovieDetails>(`/movie/${id}`, { append_to_response: 'videos,credits' })
}

export async function getTvDetails(id: number): Promise<TmdbTvDetails> {
  return tmdbFetch<TmdbTvDetails>(`/tv/${id}`, { append_to_response: 'videos,credits' })
}

export function extractTrailerKey(videos: { results: TmdbVideo[] } | undefined): string | null {
  if (!videos) return null
  const trailer = videos.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer')
  if (trailer) return trailer.key
  const anyYoutube = videos.results.find((v) => v.site === 'YouTube')
  return anyYoutube?.key ?? null
}

// Top billed only — the modal shows a single row, and TMDB's cast array
// runs to hundreds of entries for a big production.
export const TOP_CAST_SIZE = 8

// A type alias rather than an interface on purpose: only aliases get the
// implicit index signature that assigning into a jsonb column requires.
export type TopCastMember = {
  name: string
  profile_path: string | null
}

export function extractTopCast(credits: TmdbCredits | undefined): TopCastMember[] {
  const cast = credits?.cast ?? []
  return cast
    .slice(0, TOP_CAST_SIZE)
    .map((member) => ({ name: member.name, profile_path: member.profile_path }))
}

export function yearFromDate(date: string | null | undefined): number | null {
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isNaN(year) ? null : year
}

// films.id is composite ("movie:550" / "tv:1399") because TMDB numbers
// movies and TV separately — a bare numeric id would let a movie and a
// show collide on the same row.
export function buildFilmId(mediaType: 'movie' | 'tv', tmdbId: number): string {
  return `${mediaType}:${tmdbId}`
}

// The inverse, for the rare case where a stored row needs another TMDB call.
export function parseFilmId(filmId: string): { mediaType: 'movie' | 'tv'; tmdbId: number } | null {
  const [prefix, rest] = filmId.split(':')
  if (prefix !== 'movie' && prefix !== 'tv') return null
  const tmdbId = Number.parseInt(rest ?? '', 10)
  if (Number.isNaN(tmdbId)) return null
  return { mediaType: prefix, tmdbId }
}

// Credits on their own, for backfilling a film enriched before top_cast
// existed. Much smaller than re-fetching the whole details payload.
export async function getTopCast(mediaType: 'movie' | 'tv', tmdbId: number): Promise<TopCastMember[]> {
  const credits = await tmdbFetch<TmdbCredits>(`/${mediaType}/${tmdbId}/credits`, {})
  return extractTopCast(credits)
}

// Everything the stats page reads that import used to leave behind: the
// cast, the directors and the countries, from one details call. Credits
// ride along on the same request rather than costing a second one.
export interface FilmPeopleAndPlaces {
  top_cast: TopCastMember[]
  directors: CreditPerson[]
  countries: string[]
}

export async function getFilmPeopleAndPlaces(
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<FilmPeopleAndPlaces> {
  const details = await tmdbFetch<TmdbMovieDetails & TmdbTvDetails>(`/${mediaType}/${tmdbId}`, {
    append_to_response: 'credits',
  })
  return {
    top_cast: extractTopCast(details.credits),
    directors: extractDirectors(mediaType, details.credits?.crew, details.created_by),
    countries: extractCountries(details.production_countries),
  }
}

export interface NormalizedFilm {
  id: string
  media_type: 'movie' | 'tv'
  title: string
  year: number | null
  runtime: number | null
  overview: string | null
  poster_path: string | null
  backdrop_path: string | null
  original_language: string | null
  genres: string[]
  vote_average: number | null
  trailer_key: string | null
  top_cast: TopCastMember[]
  directors: CreditPerson[]
  countries: string[]
}

export function normalizeMovieDetails(details: TmdbMovieDetails): NormalizedFilm {
  return {
    id: buildFilmId('movie', details.id),
    media_type: 'movie',
    title: details.title,
    year: yearFromDate(details.release_date),
    runtime: details.runtime,
    overview: details.overview,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    original_language: details.original_language,
    genres: details.genres.map((g) => g.name),
    vote_average: details.vote_average,
    trailer_key: extractTrailerKey(details.videos),
    top_cast: extractTopCast(details.credits),
    directors: extractDirectors('movie', details.credits?.crew, undefined),
    countries: extractCountries(details.production_countries),
  }
}

export function normalizeTvDetails(details: TmdbTvDetails): NormalizedFilm {
  return {
    id: buildFilmId('tv', details.id),
    media_type: 'tv',
    title: details.name,
    year: yearFromDate(details.first_air_date),
    runtime: details.episode_run_time[0] ?? null,
    overview: details.overview,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    original_language: details.original_language,
    genres: details.genres.map((g) => g.name),
    vote_average: details.vote_average,
    trailer_key: extractTrailerKey(details.videos),
    top_cast: extractTopCast(details.credits),
    directors: extractDirectors('tv', undefined, details.created_by),
    countries: extractCountries(details.production_countries),
  }
}
