import { supabase } from '../lib/supabaseClient'
import {
  getMovieDetails,
  getTvDetails,
  normalizeMovieDetails,
  normalizeTvDetails,
  searchMovies,
  searchTv,
  yearFromDate,
  type NormalizedFilm,
  type TmdbMovieSearchResult,
  type TmdbTvSearchResult,
} from '../lib/tmdbClient'

export interface Candidate {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  year: number | null
  posterPath: string | null
}

export type MatchOutcome =
  | { status: 'reused'; filmId: number }
  | { status: 'matched'; film: NormalizedFilm }
  | { status: 'unmatched'; candidates: Candidate[] }

async function findExistingFilm(title: string, year: number): Promise<{ id: number } | null> {
  const { data } = await supabase
    .from('films')
    .select('id')
    .ilike('title', title)
    .eq('year', year)
    .limit(1)
    .maybeSingle()
  return data
}

function findConfidentMatch<T>(
  results: T[],
  name: string,
  year: number | null,
  getTitle: (r: T) => string,
  getDate: (r: T) => string,
): T | null {
  const top = results[0]
  if (!top) return null
  if (getTitle(top).trim().toLowerCase() !== name.trim().toLowerCase()) return null
  if (year === null) return null

  const resultYear = yearFromDate(getDate(top))
  if (resultYear === null) return null
  return Math.abs(resultYear - year) <= 1 ? top : null
}

function buildCandidates(
  movieResults: TmdbMovieSearchResult[],
  tvResults: TmdbTvSearchResult[],
): Candidate[] {
  const movieCandidates: Candidate[] = movieResults.slice(0, 5).map((r) => ({
    id: r.id,
    mediaType: 'movie',
    title: r.title,
    year: yearFromDate(r.release_date),
    posterPath: r.poster_path,
  }))
  const tvCandidates: Candidate[] = tvResults.slice(0, 5).map((r) => ({
    id: r.id,
    mediaType: 'tv',
    title: r.name,
    year: yearFromDate(r.first_air_date),
    posterPath: r.poster_path,
  }))
  return [...movieCandidates, ...tvCandidates].slice(0, 5)
}

// Resolves one CSV (title, year) pair to a film: reuse an existing `films`
// row if one already matches, otherwise search TMDB (movie, then tv) for a
// confident match and fetch full details, otherwise hand back candidates
// for the review list.
export async function resolveFilm(name: string, year: number | null): Promise<MatchOutcome> {
  if (year !== null) {
    const existing = await findExistingFilm(name, year)
    if (existing) return { status: 'reused', filmId: existing.id }
  }

  const movieResults = await searchMovies(name, year ?? undefined)
  const movieMatch = findConfidentMatch(
    movieResults,
    name,
    year,
    (r) => r.title,
    (r) => r.release_date,
  )
  if (movieMatch) {
    const details = await getMovieDetails(movieMatch.id)
    return { status: 'matched', film: normalizeMovieDetails(details) }
  }

  const tvResults = await searchTv(name, year ?? undefined)
  const tvMatch = findConfidentMatch(
    tvResults,
    name,
    year,
    (r) => r.name,
    (r) => r.first_air_date,
  )
  if (tvMatch) {
    const details = await getTvDetails(tvMatch.id)
    return { status: 'matched', film: normalizeTvDetails(details) }
  }

  return { status: 'unmatched', candidates: buildCandidates(movieResults, tvResults) }
}

export async function resolveCandidate(mediaType: 'movie' | 'tv', tmdbId: number): Promise<NormalizedFilm> {
  if (mediaType === 'movie') {
    return normalizeMovieDetails(await getMovieDetails(tmdbId))
  }
  return normalizeTvDetails(await getTvDetails(tmdbId))
}
