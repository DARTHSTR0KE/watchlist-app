import type { CreditPerson } from '../lib/filmCredits'

/**
 * Everything the stats page shows, reduced in the app from raw rows. No
 * views or functions in the database: a few thousand rows is nothing to
 * reduce here, and this stays easy to change.
 *
 * Nothing in this file touches Supabase, so it can be tested as is.
 */

export interface WatchedRecord {
  filmId: string
  rating: number | null
  watchedOn: string | null
  // Three-valued: true with them, false on my own, null not yet asked.
  together: boolean | null
}

export interface FilmFacts {
  title: string
  runtime: number | null
  genres: string[]
  originalLanguage: string | null
  mediaType: 'movie' | 'tv'
  posterPath: string | null
  // Null means never fetched, which is not the same as an empty list: a
  // film can genuinely have no director on TMDB.
  topCast: CreditPerson[] | null
  directors: CreditPerson[] | null
  countries: string[] | null
}

export interface SpinRecord {
  filmId: string | null
  outcome: string | null
  createdAt: string | null
}

export interface StatsRaw {
  // Every film either of us marked as watched together. One shared fact,
  // read with no user filter, so both of us see the same number.
  togetherFilmIds: Set<string>
  mine: WatchedRecord[]
  theirs: WatchedRecord[]
  films: Map<string, FilmFacts>
  spins: SpinRecord[]
  // Titles for the films spins landed on, most of which are still on the
  // list rather than watched.
  spinTitles: Map<string, string>
}

// 'all', or a calendar year.
export type YearChoice = 'all' | number

/* ------------------------------------------------------------------ */
/* Which films, and when                                               */
/* ------------------------------------------------------------------ */

/**
 * Everything I have watched, resolved per film rather than per row. My own
 * rows, plus any film either of us marked as watched together — a film we
 * sat through together is one I have seen whether or not I ever logged a
 * row of my own for it.
 */
export function resolvedWatched(raw: StatsRaw): WatchedRecord[] {
  const byFilm = new Map<string, WatchedRecord>()
  // Mine first: where both of us have a row, my own answer is the one that
  // carries my rating and my date.
  for (const record of raw.mine) byFilm.set(record.filmId, record)
  for (const record of raw.theirs) {
    if (!raw.togetherFilmIds.has(record.filmId)) continue
    if (!byFilm.has(record.filmId)) byFilm.set(record.filmId, record)
  }
  return [...byFilm.values()]
}

// watched_on is a plain date, so its year is its first four characters —
// no time zone gets a chance to move it into the year either side.
function yearOfDate(date: string | null): number | null {
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isNaN(year) ? null : year
}

// A spin's created_at is a timestamp, read in local time: a spin at ten
// past midnight on New Year's Day belongs to the year it felt like.
function yearOfTimestamp(timestamp: string | null): number | null {
  if (!timestamp) return null
  const time = new Date(timestamp)
  return Number.isNaN(time.getTime()) ? null : time.getFullYear()
}

// A watch with no date only belongs to All time; it can't be placed in
// any one year.
export function inYear(year: YearChoice, value: number | null): boolean {
  return year === 'all' || value === year
}

// Every year I watched something, newest first.
export function watchedYears(raw: StatsRaw): number[] {
  const years = new Set<number>()
  for (const record of resolvedWatched(raw)) {
    const year = yearOfDate(record.watchedOn)
    if (year !== null) years.add(year)
  }
  return [...years].sort((a, b) => b - a)
}

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

export interface Tally {
  label: string
  count: number
}

export interface PersonTally {
  name: string
  profilePath: string | null
  count: number
}

// How much of the range a TMDB-derived section can see. Separate from the
// tallies so the screen can tell "none yet" from "not fetched yet".
export interface Coverage {
  known: number
  missing: number
}

export interface RatedFilm {
  filmId: string
  title: string
  posterPath: string | null
  rating: number
}

export interface Disagreement {
  filmId: string
  title: string
  mine: number
  theirs: number
  gap: number
}

export interface WheelStats {
  totalSpins: number
  averageRerolls: number | null
  mostDodged: { title: string; count: number } | null
}

export interface Stats {
  watchedCount: number
  filmCount: number
  showCount: number
  // Films only. A TV runtime is one episode, so summing shows would claim
  // a 60-episode series took 50 minutes.
  filmHours: number

  actors: PersonTally[]
  actorCoverage: Coverage
  directors: PersonTally[]
  directorCoverage: Coverage
  countries: Tally[]
  countryCoverage: Coverage

  highest: RatedFilm[]
  lowest: RatedFilm[]
  ratedCount: number

  genres: Tally[]
  languages: Tally[]

  togetherCount: number
  aloneCount: number
  // Watched but never answered. Kept apart from "on my own", which is an
  // answer rather than the absence of one.
  unansweredCount: number

  bothRatedCount: number
  disagreements: Disagreement[]

  wheel: WheelStats

  ratingHistogram: { rating: string; count: number }[]
  // Both averages over the same films — the ones we have both rated — so
  // the comparison is like for like.
  myAverageShared: number | null
  theirAverageShared: number | null
}

/* ------------------------------------------------------------------ */
/* Reducing                                                            */
/* ------------------------------------------------------------------ */

export const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const PEOPLE_SHOWN = 15
const POSTERS_SHOWN = 3
const DISAGREEMENTS_SHOWN = 5

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function bump(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function topTally(counts: Map<string, number>, limit: number): Tally[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

// People are keyed by name: top_cast carries no TMDB id. Two actors
// sharing a name would merge, which is rare enough to live with.
function tallyPeople(
  films: FilmFacts[],
  pick: (film: FilmFacts) => CreditPerson[] | null,
): { people: PersonTally[]; coverage: Coverage } {
  const byName = new Map<string, PersonTally>()
  let known = 0
  let missing = 0
  for (const film of films) {
    const people = pick(film)
    if (people === null) {
      missing += 1
      continue
    }
    known += 1
    // One credit per film, even if TMDB lists someone twice.
    for (const name of new Set(people.map((person) => person.name))) {
      const person = people.find((entry) => entry.name === name)!
      const existing = byName.get(name)
      if (existing) {
        existing.count += 1
        existing.profilePath ??= person.profile_path
      } else {
        byName.set(name, { name, profilePath: person.profile_path, count: 1 })
      }
    }
  }
  const people = [...byName.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, PEOPLE_SHOWN)
  return { people, coverage: { known, missing } }
}

function computeWheel(raw: StatsRaw, year: YearChoice): WheelStats {
  const spins = raw.spins
    .filter((spin) => inYear(year, yearOfTimestamp(spin.createdAt)))
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

  let rerollRun = 0
  const rerollRuns: number[] = []
  const dodged = new Map<string, number>()
  for (const spin of spins) {
    if (spin.outcome === 'rerolled') {
      rerollRun += 1
      if (spin.filmId) bump(dodged, spin.filmId)
      continue
    }
    if (spin.outcome === 'watched') {
      // Mirrors the app's own budget, which only "Watch this" resets.
      rerollRuns.push(rerollRun)
      rerollRun = 0
    }
  }

  const topDodged = [...dodged.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    totalSpins: spins.length,
    averageRerolls: average(rerollRuns),
    mostDodged: topDodged
      ? {
          title: raw.spinTitles.get(topDodged[0]) ?? raw.films.get(topDodged[0])?.title ?? 'Unknown',
          count: topDodged[1],
        }
      : null,
  }
}

export function computeStats(
  raw: StatsRaw,
  year: YearChoice,
  names: { language: (code: string) => string; country: (code: string) => string },
): Stats {
  const watched = resolvedWatched(raw).filter((record) =>
    inYear(year, yearOfDate(record.watchedOn)),
  )
  const films = watched
    .map((record) => raw.films.get(record.filmId))
    .filter((film): film is FilmFacts => film !== undefined)

  let filmCount = 0
  let showCount = 0
  let filmMinutes = 0
  const genres = new Map<string, number>()
  const languages = new Map<string, number>()
  const countries = new Map<string, number>()
  let countriesKnown = 0
  let countriesMissing = 0

  for (const film of films) {
    if (film.mediaType === 'tv') showCount += 1
    else {
      filmCount += 1
      filmMinutes += film.runtime ?? 0
    }
    for (const genre of film.genres) bump(genres, genre)
    if (film.originalLanguage) bump(languages, names.language(film.originalLanguage))
    if (film.countries === null) countriesMissing += 1
    else {
      countriesKnown += 1
      for (const code of film.countries) bump(countries, names.country(code))
    }
  }

  let togetherCount = 0
  let aloneCount = 0
  for (const record of watched) {
    // The shared fact decides, not my own row's answer: if either of us
    // said together, it was together.
    if (raw.togetherFilmIds.has(record.filmId)) togetherCount += 1
    else if (record.together === false) aloneCount += 1
  }

  const actors = tallyPeople(films, (film) => film.topCast)
  const directors = tallyPeople(films, (film) => film.directors)

  // Ratings are mine alone, dated by my own row.
  const myRated = raw.mine.filter(
    (record): record is WatchedRecord & { rating: number } =>
      record.rating !== null && inYear(year, yearOfDate(record.watchedOn)),
  )
  const toRated = (record: WatchedRecord & { rating: number }): RatedFilm => {
    const film = raw.films.get(record.filmId)
    return {
      filmId: record.filmId,
      title: film?.title ?? 'Unknown',
      posterPath: film?.posterPath ?? null,
      rating: record.rating,
    }
  }
  // Among equal ratings, the more recent watch stands for it.
  const byRecent = (a: WatchedRecord, b: WatchedRecord) =>
    (b.watchedOn ?? '').localeCompare(a.watchedOn ?? '')
  const highestRecords = [...myRated]
    .sort((a, b) => b.rating - a.rating || byRecent(a, b))
    .slice(0, POSTERS_SHOWN)
  // Strictly below the highest shown, so a film never appears as both, and
  // a run of equal ratings isn't passed off as a low.
  const floor = Math.min(...highestRecords.map((record) => record.rating))
  const lowestRecords = myRated
    .filter((record) => record.rating < floor)
    .sort((a, b) => a.rating - b.rating || byRecent(a, b))
    .slice(0, POSTERS_SHOWN)

  // Films we've both rated. Their row is only visible to me when it was
  // together, so this is the together films by construction.
  const theirsById = new Map(raw.theirs.map((record) => [record.filmId, record]))
  const disagreements: Disagreement[] = []
  const mineShared: number[] = []
  const theirsShared: number[] = []
  for (const mine of myRated) {
    const theirs = theirsById.get(mine.filmId)
    if (!theirs || theirs.rating === null) continue
    mineShared.push(mine.rating)
    theirsShared.push(theirs.rating)
    disagreements.push({
      filmId: mine.filmId,
      title: raw.films.get(mine.filmId)?.title ?? 'Unknown',
      mine: mine.rating,
      theirs: theirs.rating,
      gap: Math.abs(mine.rating - theirs.rating),
    })
  }

  return {
    watchedCount: watched.length,
    filmCount,
    showCount,
    filmHours: filmMinutes / 60,

    actors: actors.people,
    actorCoverage: actors.coverage,
    directors: directors.people,
    directorCoverage: directors.coverage,
    countries: topTally(countries, Number.POSITIVE_INFINITY),
    countryCoverage: { known: countriesKnown, missing: countriesMissing },

    highest: highestRecords.map(toRated),
    lowest: lowestRecords.map(toRated),
    ratedCount: myRated.length,

    genres: topTally(genres, 8),
    languages: topTally(languages, 8),

    togetherCount,
    aloneCount,
    unansweredCount: watched.length - togetherCount - aloneCount,

    bothRatedCount: disagreements.length,
    // A gap of nothing isn't a disagreement.
    disagreements: disagreements
      .filter((entry) => entry.gap > 0)
      .sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title))
      .slice(0, DISAGREEMENTS_SHOWN),

    wheel: computeWheel(raw, year),

    ratingHistogram: RATING_BUCKETS.map((bucket) => ({
      rating: Number.isInteger(bucket) ? String(bucket) : bucket.toFixed(1),
      count: myRated.filter((record) => record.rating === bucket).length,
    })),
    myAverageShared: average(mineShared),
    theirAverageShared: average(theirsShared),
  }
}
