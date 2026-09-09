import { supabase } from '../lib/supabaseClient'
import type { WheelFilters } from '../wheel/filters'

/**
 * Everything the stats page needs, fetched raw and reduced in the app.
 * Deliberately no views or functions in the database: a few thousand rows
 * is nothing to reduce client-side, and this stays easy to change.
 */

export interface WatchedRecord {
  filmId: string
  rating: number | null
  watchedOn: string | null
  together: boolean
  pickedBy: string | null
}

export interface FilmFacts {
  title: string
  year: number | null
  runtime: number | null
  genres: string[]
  originalLanguage: string | null
  mediaType: 'movie' | 'tv'
}

export interface StatsRaw {
  mine: WatchedRecord[]
  theirs: WatchedRecord[]
  films: Map<string, FilmFacts>
  watchlist: { filmId: string; addedAt: string | null }[]
  spins: { filmId: string | null; outcome: string | null; createdAt: string | null; filters: WheelFilters | null }[]
  recommendations: { fromUser: string; toUser: string; filmId: string; createdAt: string | null }[]
  presets: { name: string; filters: WheelFilters }[]
}

interface WatchedJoinRow {
  film_id: string
  rating: number | null
  watched_on: string | null
  together: boolean
  picked_by: string | null
  films: {
    title: string
    year: number | null
    runtime: number | null
    genres: string[] | null
    original_language: string | null
    media_type: 'movie' | 'tv'
  } | null
}

function collectFilms(rows: WatchedJoinRow[], into: Map<string, FilmFacts>) {
  for (const row of rows) {
    if (!row.films || into.has(row.film_id)) continue
    into.set(row.film_id, {
      title: row.films.title,
      year: row.films.year,
      runtime: row.films.runtime,
      genres: row.films.genres ?? [],
      originalLanguage: row.films.original_language,
      mediaType: row.films.media_type,
    })
  }
}

const WATCHED_COLUMNS =
  'film_id, rating, watched_on, together, picked_by, films(title, year, runtime, genres, original_language, media_type)'

async function fetchWatched(userId: string): Promise<WatchedJoinRow[]> {
  const { data, error } = await supabase
    .from('watched')
    .select(WATCHED_COLUMNS)
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as unknown as WatchedJoinRow[]
}

function toRecord(row: WatchedJoinRow): WatchedRecord {
  return {
    filmId: row.film_id,
    rating: row.rating,
    watchedOn: row.watched_on,
    together: row.together,
    pickedBy: row.picked_by,
  }
}

export async function loadStatsRaw(userId: string, partnerId: string | null): Promise<StatsRaw> {
  const [mineRows, theirRows, watchlist, spins, recommendations, presets] = await Promise.all([
    fetchWatched(userId),
    partnerId ? fetchWatched(partnerId) : Promise.resolve([] as WatchedJoinRow[]),
    supabase
      .from('watchlist_items')
      .select('film_id, added_at, films(title, year, runtime, genres, original_language, media_type)')
      .eq('user_id', userId),
    supabase.from('spins').select('film_id, outcome, created_at, filters').eq('user_id', userId),
    supabase.from('recommendations').select('from_user, to_user, film_id, created_at'),
    // Not one of the four tables, but a preset can't be named without it.
    supabase.from('filter_presets').select('name, filters').eq('user_id', userId),
  ])

  const films = new Map<string, FilmFacts>()
  collectFilms(mineRows, films)
  collectFilms(theirRows, films)
  collectFilms((watchlist.data ?? []) as unknown as WatchedJoinRow[], films)

  return {
    mine: mineRows.map(toRecord),
    theirs: theirRows.map(toRecord),
    films,
    watchlist: (watchlist.data ?? []).map((row) => ({
      filmId: row.film_id,
      addedAt: row.added_at,
    })),
    spins: (spins.data ?? []).map((row) => ({
      filmId: row.film_id,
      outcome: row.outcome,
      createdAt: row.created_at,
      filters: (row.filters as unknown as WheelFilters | null) ?? null,
    })),
    recommendations: (recommendations.data ?? []).map((row) => ({
      fromUser: row.from_user,
      toUser: row.to_user,
      filmId: row.film_id,
      createdAt: row.created_at,
    })),
    presets: (presets.data ?? []).map((row) => ({
      name: row.name,
      filters: row.filters as unknown as WheelFilters,
    })),
  }
}

/* ------------------------------------------------------------------ */
/* Viewing                                                             */
/* ------------------------------------------------------------------ */

export interface Tally {
  label: string
  count: number
}

function topTally(counts: Map<string, number>, limit: number): Tally[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export interface ViewingStats {
  filmCount: number
  showCount: number
  // Films only. A TV runtime is one episode, so summing shows would claim
  // a 60-episode series took 50 minutes.
  filmHours: number
  genres: Tally[]
  languages: Tally[]
  decades: Tally[]
  ratingHistogram: { rating: string; count: number }[]
  myAverage: number | null
  theirAverage: number | null
  ratedCount: number
  togetherCount: number
  aloneCount: number
}

export const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function computeViewing(raw: StatsRaw, languageName: (code: string) => string): ViewingStats {
  const genres = new Map<string, number>()
  const languages = new Map<string, number>()
  const decades = new Map<string, number>()
  let filmCount = 0
  let showCount = 0
  let filmMinutes = 0
  let togetherCount = 0

  for (const record of raw.mine) {
    const film = raw.films.get(record.filmId)
    if (record.together) togetherCount += 1
    if (!film) continue

    if (film.mediaType === 'tv') showCount += 1
    else {
      filmCount += 1
      filmMinutes += film.runtime ?? 0
    }

    for (const genre of film.genres) genres.set(genre, (genres.get(genre) ?? 0) + 1)
    if (film.originalLanguage) {
      const label = languageName(film.originalLanguage)
      languages.set(label, (languages.get(label) ?? 0) + 1)
    }
    if (film.year && film.year > 0) {
      const decade = `${Math.floor(film.year / 10) * 10}s`
      decades.set(decade, (decades.get(decade) ?? 0) + 1)
    }
  }

  const myRatings = raw.mine.filter((r) => r.rating !== null).map((r) => r.rating!)
  const theirRatings = raw.theirs.filter((r) => r.rating !== null).map((r) => r.rating!)
  const histogram = RATING_BUCKETS.map((bucket) => ({
    rating: Number.isInteger(bucket) ? String(bucket) : bucket.toFixed(1),
    count: myRatings.filter((value) => value === bucket).length,
  }))

  return {
    filmCount,
    showCount,
    filmHours: filmMinutes / 60,
    genres: topTally(genres, 8),
    languages: topTally(languages, 8),
    decades: [...decades.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    ratingHistogram: histogram,
    myAverage: average(myRatings),
    theirAverage: average(theirRatings),
    ratedCount: myRatings.length,
    togetherCount,
    aloneCount: raw.mine.length - togetherCount,
  }
}

/* ------------------------------------------------------------------ */
/* The two of us                                                       */
/* ------------------------------------------------------------------ */

export interface Disagreement {
  filmId: string
  title: string
  mine: number
  theirs: number
  gap: number
}

export interface RecommenderRecord {
  sent: number
  watched: number
  average: number | null
}

export interface TogetherStats {
  bothRatedCount: number
  // Mean absolute gap in stars — the plainest reading of "how closely".
  averageGap: number | null
  agreeWithinHalf: number
  disagreements: Disagreement[]
  myRecommending: RecommenderRecord
  theirRecommending: RecommenderRecord
  // Null when there isn't enough to call it either way.
  betterRecommender: 'me' | 'them' | 'tie' | null
  picks: { label: string; count: number }[]
}

export function computeTogether(
  raw: StatsRaw,
  userId: string,
  partnerId: string | null,
  partnerName: string,
): TogetherStats {
  const mineById = new Map(raw.mine.map((r) => [r.filmId, r]))
  const theirsById = new Map(raw.theirs.map((r) => [r.filmId, r]))

  const disagreements: Disagreement[] = []
  let gapSum = 0
  let bothRated = 0
  let withinHalf = 0

  for (const [filmId, mine] of mineById) {
    const theirs = theirsById.get(filmId)
    if (mine.rating === null || !theirs || theirs.rating === null) continue
    const gap = Math.abs(mine.rating - theirs.rating)
    bothRated += 1
    gapSum += gap
    if (gap <= 0.5) withinHalf += 1
    disagreements.push({
      filmId,
      title: raw.films.get(filmId)?.title ?? 'Unknown',
      mine: mine.rating,
      theirs: theirs.rating,
      gap,
    })
  }

  disagreements.sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title))

  const recordFor = (fromUser: string, toUser: string): RecommenderRecord => {
    const sent = raw.recommendations.filter(
      (rec) => rec.fromUser === fromUser && rec.toUser === toUser,
    )
    const recipientWatched = toUser === userId ? mineById : theirsById
    // The watched table is the truth, not the recommendation's own status —
    // the recipient may have watched it without ever opening the screen.
    const landed = sent.filter((rec) => recipientWatched.has(rec.filmId))
    const ratings = landed
      .map((rec) => recipientWatched.get(rec.filmId)!.rating)
      .filter((value): value is number => value !== null)
    return { sent: sent.length, watched: landed.length, average: average(ratings) }
  }

  const myRecommending = partnerId
    ? recordFor(userId, partnerId)
    : { sent: 0, watched: 0, average: null }
  const theirRecommending = partnerId
    ? recordFor(partnerId, userId)
    : { sent: 0, watched: 0, average: null }

  // Judged on what the other person actually thought of them. Without a
  // rating on each side there is nothing to compare, and saying so is
  // better than crowning someone on one data point.
  let betterRecommender: TogetherStats['betterRecommender'] = null
  if (myRecommending.average !== null && theirRecommending.average !== null) {
    const difference = myRecommending.average - theirRecommending.average
    betterRecommender = Math.abs(difference) < 0.25 ? 'tie' : difference > 0 ? 'me' : 'them'
  }

  // One row per film rather than per person, so a shared watch logged by
  // both of us isn't counted twice.
  const pickCounts = new Map<string, number>()
  const seen = new Set<string>()
  for (const record of [...raw.mine, ...raw.theirs]) {
    if (seen.has(record.filmId)) continue
    seen.add(record.filmId)
    // My own account of who picked it wins; theirs only stands in when I
    // have no row. Not `??`, which would treat my "the wheel picked it"
    // (null) as an absence and fall through to theirs.
    const mineRow = mineById.get(record.filmId)
    const pickedBy = mineRow ? mineRow.pickedBy : record.pickedBy
    const label =
      pickedBy === null ? 'The wheel' : pickedBy === userId ? 'You' : partnerName
    pickCounts.set(label, (pickCounts.get(label) ?? 0) + 1)
  }

  return {
    bothRatedCount: bothRated,
    averageGap: bothRated === 0 ? null : gapSum / bothRated,
    agreeWithinHalf: withinHalf,
    disagreements: disagreements.slice(0, 5),
    myRecommending,
    theirRecommending,
    betterRecommender,
    picks: [...pickCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  }
}

/* ------------------------------------------------------------------ */
/* The wheel                                                           */
/* ------------------------------------------------------------------ */

export interface WheelStats {
  totalSpins: number
  watchedSpins: number
  averageRerolls: number | null
  mostDodged: { title: string; count: number } | null
  filterUse: Tally[]
  presetUse: Tally[]
}

const FILTER_LABELS: { key: keyof WheelFilters; label: string; active: (f: WheelFilters) => boolean }[] = [
  { key: 'mediaType', label: 'Media type', active: (f) => f.mediaType !== 'both' },
  { key: 'languages', label: 'Language', active: (f) => (f.languages?.length ?? 0) > 0 },
  { key: 'genres', label: 'Genre', active: (f) => (f.genres?.length ?? 0) > 0 },
  { key: 'maxRuntime', label: 'Runtime', active: (f) => f.maxRuntime !== null },
  { key: 'decadeFrom', label: 'Decade', active: (f) => f.decadeFrom !== null || f.decadeTo !== null },
  { key: 'excludeWatched', label: 'Unwatched only', active: (f) => f.excludeWatched === true },
  { key: 'ratingMode', label: 'Rating', active: (f) => f.ratingMode !== undefined && f.ratingMode !== 'any' },
]

// Key order is not meaningful — both sides have been through jsonb, which
// normalises it — so compare on sorted keys rather than trusting that.
function stableStringify(value: WheelFilters): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value as unknown as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    ),
  )
}

function sameFilters(a: WheelFilters, b: WheelFilters): boolean {
  return stableStringify(a) === stableStringify(b)
}

export function computeWheel(raw: StatsRaw): WheelStats {
  const ordered = [...raw.spins].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))

  let watchedSpins = 0
  let rerollRun = 0
  const rerollRuns: number[] = []
  for (const spin of ordered) {
    if (spin.outcome === 'rerolled') {
      rerollRun += 1
      continue
    }
    if (spin.outcome === 'watched') {
      watchedSpins += 1
      // Mirrors the app's own budget, which only "Watch this" resets.
      rerollRuns.push(rerollRun)
      rerollRun = 0
    }
  }

  const dodged = new Map<string, number>()
  for (const spin of raw.spins) {
    if (spin.outcome !== 'rerolled' || !spin.filmId) continue
    dodged.set(spin.filmId, (dodged.get(spin.filmId) ?? 0) + 1)
  }
  const topDodged = [...dodged.entries()].sort((a, b) => b[1] - a[1])[0]

  const filterCounts = new Map<string, number>()
  for (const spin of raw.spins) {
    if (!spin.filters) continue
    for (const entry of FILTER_LABELS) {
      if (entry.active(spin.filters)) {
        filterCounts.set(entry.label, (filterCounts.get(entry.label) ?? 0) + 1)
      }
    }
  }

  // Spins don't record which preset was applied, so one is recognised by
  // its filters matching. A preset edited since will not match its own
  // past spins.
  const presetCounts = new Map<string, number>()
  for (const spin of raw.spins) {
    if (!spin.filters) continue
    for (const preset of raw.presets) {
      if (sameFilters(spin.filters, preset.filters)) {
        presetCounts.set(preset.name, (presetCounts.get(preset.name) ?? 0) + 1)
      }
    }
  }

  return {
    totalSpins: raw.spins.length,
    watchedSpins,
    averageRerolls: rerollRuns.length === 0 ? null : average(rerollRuns),
    mostDodged: topDodged
      ? { title: raw.films.get(topDodged[0])?.title ?? 'Unknown', count: topDodged[1] }
      : null,
    filterUse: topTally(filterCounts, 6),
    presetUse: topTally(presetCounts, 5),
  }
}

/* ------------------------------------------------------------------ */
/* The watchlist                                                       */
/* ------------------------------------------------------------------ */

export interface WatchlistStats {
  total: number
  addedPerMonth: number
  watchedPerMonth: number
  // Null when the list grows at least as fast as it shrinks.
  monthsToClear: number | null
  oldest: { title: string; addedAt: string; months: number }[]
  neverLanded: number
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44
const RATE_WINDOW_MONTHS = 12

function monthsBetween(from: string, to: number): number {
  const then = new Date(from).getTime()
  if (Number.isNaN(then)) return 0
  return (to - then) / MS_PER_MONTH
}

export function computeWatchlist(raw: StatsRaw, now = Date.now()): WatchlistStats {
  const watchedIds = new Set(raw.mine.map((r) => r.filmId))
  const cutoff = now - RATE_WINDOW_MONTHS * MS_PER_MONTH

  const addedRecently = raw.watchlist.filter(
    (item) => item.addedAt !== null && new Date(item.addedAt).getTime() >= cutoff,
  ).length
  const watchedRecently = raw.mine.filter(
    (record) => record.watchedOn !== null && new Date(record.watchedOn).getTime() >= cutoff,
  ).length

  const addedPerMonth = addedRecently / RATE_WINDOW_MONTHS
  const watchedPerMonth = watchedRecently / RATE_WINDOW_MONTHS
  const net = watchedPerMonth - addedPerMonth

  const unwatched = raw.watchlist.filter((item) => !watchedIds.has(item.filmId))
  const oldest = unwatched
    .filter((item) => item.addedAt !== null)
    .sort((a, b) => (a.addedAt ?? '').localeCompare(b.addedAt ?? ''))
    .slice(0, 5)
    .map((item) => ({
      title: raw.films.get(item.filmId)?.title ?? 'Unknown',
      addedAt: item.addedAt!,
      months: monthsBetween(item.addedAt!, now),
    }))

  // spins holds the film each spin landed on, not the eight it showed, so
  // this counts titles never landed on rather than never displayed.
  const landed = new Set(raw.spins.map((spin) => spin.filmId).filter((id): id is string => id !== null))

  return {
    total: raw.watchlist.length,
    addedPerMonth,
    watchedPerMonth,
    monthsToClear: net > 0 ? unwatched.length / net : null,
    oldest,
    neverLanded: raw.watchlist.filter((item) => !landed.has(item.filmId)).length,
  }
}
