/**
 * The people and places behind a film, pulled out of TMDB's payloads.
 * Pure on purpose: tmdbClient refuses to load without an API key, and
 * these are worth testing without one.
 */

// A type alias rather than an interface on purpose: only aliases get the
// implicit index signature that assigning into a jsonb column requires.
export type CreditPerson = {
  name: string
  profile_path: string | null
}

export interface TmdbCrewMember {
  name: string
  job?: string
  profile_path: string | null
}

export interface TmdbCreator {
  name: string
  profile_path: string | null
}

export interface TmdbCountry {
  iso_3166_1: string
  name?: string
}

// A film's directors come from its crew. A show has no director of its
// own — each episode has one — so its creators stand in.
export function extractDirectors(
  mediaType: 'movie' | 'tv',
  crew: TmdbCrewMember[] | undefined,
  createdBy: TmdbCreator[] | undefined,
): CreditPerson[] {
  const people =
    mediaType === 'tv' ? (createdBy ?? []) : (crew ?? []).filter((member) => member.job === 'Director')
  // TMDB occasionally lists the same person twice; one film is one credit.
  const seen = new Set<string>()
  const directors: CreditPerson[] = []
  for (const person of people) {
    if (!person.name || seen.has(person.name)) continue
    seen.add(person.name)
    directors.push({ name: person.name, profile_path: person.profile_path ?? null })
  }
  return directors
}

// Stored as ISO 3166-1 codes, not TMDB's English names, so the screen can
// name them in the viewer's own words and "United States of America" can
// be the shorter thing people actually say.
export function extractCountries(countries: TmdbCountry[] | undefined): string[] {
  const codes = (countries ?? [])
    .map((country) => country.iso_3166_1?.toUpperCase())
    .filter((code): code is string => Boolean(code))
  return [...new Set(codes)]
}
