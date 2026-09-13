import {
  getCombinedCredits,
  searchMovies,
  searchPeople,
  searchTv,
  yearFromDate,
} from '../lib/tmdbClient'
import type { TmdbCredit } from '../lib/tmdbClient'

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

export interface PersonResult {
  id: number
  name: string
  profilePath: string | null
  // What TMDB thinks they are mainly known for, used only as a hint.
  department: string | null
}

export async function searchPeopleByName(query: string): Promise<PersonResult[]> {
  const people = await searchPeople(query)
  return people.slice(0, 12).map((p) => ({
    id: p.id,
    name: p.name,
    profilePath: p.profile_path,
    department: p.known_for_department,
  }))
}

export interface CreditResult extends ManualResult {
  popularity: number
}

export interface Filmography {
  // Empty groups are dropped by the caller; somebody who both acts and
  // directs gets both, labelled.
  acting: CreditResult[]
  directing: CreditResult[]
}

function toCredit(credit: TmdbCredit): CreditResult | null {
  if (credit.media_type !== 'movie' && credit.media_type !== 'tv') return null
  const title = credit.title ?? credit.name
  if (!title) return null
  return {
    id: credit.id,
    mediaType: credit.media_type,
    title,
    year: yearFromDate(credit.release_date ?? credit.first_air_date),
    posterPath: credit.poster_path,
    popularity: credit.popularity ?? 0,
  }
}

// Popularity first, then newest within that. TMDB popularity is a float so
// exact ties are rare; the year is what settles them when they happen.
function rank(a: CreditResult, b: CreditResult): number {
  if (b.popularity !== a.popularity) return b.popularity - a.popularity
  return (b.year ?? 0) - (a.year ?? 0)
}

function dedupe(credits: CreditResult[]): CreditResult[] {
  const seen = new Set<string>()
  return credits.filter((c) => {
    const key = `${c.mediaType}:${c.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Everything a person is credited on, in two groups: what they acted in,
 * and what they directed. Both come from one request — listing a hundred
 * credits must not mean a hundred lookups.
 */
export async function loadFilmography(personId: number): Promise<Filmography> {
  const credits = await getCombinedCredits(personId)
  const acting = dedupe(
    (credits.cast ?? []).map(toCredit).filter((c): c is CreditResult => c !== null),
  ).sort(rank)
  const directing = dedupe(
    (credits.crew ?? [])
      .filter((c) => c.job === 'Director')
      .map(toCredit)
      .filter((c): c is CreditResult => c !== null),
  ).sort(rank)
  return { acting, directing }
}

// The person's most popular work across both groups, for the one-tap add.
export function topByPopularity(filmography: Filmography, limit: number): CreditResult[] {
  return dedupe([...filmography.acting, ...filmography.directing].sort(rank)).slice(0, limit)
}
