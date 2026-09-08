import type { WheelItem } from './titles'

// Which pool the wheel draws from. 'watchlist' is the films still to see;
// 'rewatch' and 'both-loved' come from the watched table; 'custom' is a
// hand-built wheel, which no filter touches.
export type WheelSource = 'watchlist' | 'rewatch' | 'both-loved' | 'custom'

export type RatingMode = 'any' | 'min' | 'exact' | 'unrated'

export interface WheelFilters {
  source: WheelSource
  mediaType: 'movie' | 'tv' | 'both'
  // Empty means "no restriction", not "nothing matches".
  languages: string[]
  genres: string[]
  maxRuntime: number | null
  decadeFrom: number | null
  decadeTo: number | null
  excludeWatched: boolean
  // Rewatch only. 'unrated' is for films seen but never scored.
  ratingMode: RatingMode
  ratingValue: number
  // Both watched sources. Excludes anything seen more recently than this
  // many months ago; null lifts the restriction entirely.
  watchedBeforeMonths: number | null
  // Both loved it: the score each of us must have given.
  bothLovedThreshold: number
  // Which hand-built wheel is selected. Only meaningful when source is
  // 'custom'; null there means one still has to be chosen.
  customWheelId: string | null
}

export const DEFAULT_FILTERS: WheelFilters = {
  source: 'watchlist',
  mediaType: 'both',
  languages: [],
  genres: [],
  maxRuntime: null,
  decadeFrom: null,
  decadeTo: null,
  excludeWatched: false,
  ratingMode: 'any',
  ratingValue: 4,
  // A rewatch wheel offering last month's films is useless, so this starts
  // switched on at two years rather than off.
  watchedBeforeMonths: 24,
  bothLovedThreshold: 4,
  customWheelId: null,
}

export const RUNTIME_STEP = 15
export const RUNTIME_MIN = 60

// Letterboxd's scale, which is what the watched table stores.
export const RATING_STEP = 0.5
export const RATING_MIN = 0.5
export const RATING_MAX = 5

export const WATCHED_BEFORE_OPTIONS: { months: number | null; label: string }[] = [
  { months: 6, label: '6 months' },
  { months: 12, label: 'a year' },
  { months: 24, label: '2 years' },
  { months: 60, label: '5 years' },
  { months: null, label: 'no limit' },
]

// The two sources backed by the watched table.
export function isWatchedSource(source: WheelSource): boolean {
  return source === 'rewatch' || source === 'both-loved'
}

// A hand-built wheel is spun exactly as assembled: no filtering, no
// sampling, no weighting. The choosing was already done by hand.
export function isCustomSource(source: WheelSource): boolean {
  return source === 'custom'
}

export const SOURCE_LABELS: Record<WheelSource, string> = {
  watchlist: 'To watch',
  rewatch: 'Watch again',
  'both-loved': 'Both loved it',
  custom: 'My wheels',
}

// Only the dimensions that actually narrow a pool. `source` chooses the
// pool itself, so it is deliberately not one of these.
export type FilterKey =
  | 'mediaType'
  | 'languages'
  | 'genres'
  | 'maxRuntime'
  | 'decadeFrom'
  | 'decadeTo'
  | 'excludeWatched'
  | 'rating'
  | 'watchedBefore'
  | 'bothLoved'

export const FILTER_LABELS: Record<FilterKey, string> = {
  mediaType: 'media type',
  languages: 'language',
  genres: 'genre',
  maxRuntime: 'maximum runtime',
  decadeFrom: 'release decade',
  decadeTo: 'release decade',
  excludeWatched: 'already watched',
  rating: 'rating',
  watchedBefore: 'how long ago',
  bothLoved: 'both loved it',
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44

function monthsSince(date: string): number {
  const then = new Date(date).getTime()
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY
  return (Date.now() - then) / MS_PER_MONTH
}

function matchesRating(rating: number | null, mode: RatingMode, value: number): boolean {
  switch (mode) {
    case 'any':
      return true
    case 'min':
      return rating !== null && rating >= value
    case 'exact':
      return rating !== null && rating === value
    case 'unrated':
      return rating === null
  }
}

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' })

// TMDB gives ISO codes; show them as names, falling back to the raw code
// for anything Intl doesn't recognise.
export function languageLabel(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code
  } catch {
    return code
  }
}

export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10
}

// Each filter as its own predicate, so a single dimension can be relaxed
// when counting facets or working out which one is too tight.
function predicates(
  filters: WheelFilters,
  watchedIds: Set<string>,
): Record<FilterKey, (item: WheelItem) => boolean> {
  return {
    mediaType: (item) => filters.mediaType === 'both' || item.mediaType === filters.mediaType,
    languages: (item) =>
      filters.languages.length === 0 ||
      (item.originalLanguage !== null && filters.languages.includes(item.originalLanguage)),
    genres: (item) =>
      filters.genres.length === 0 || item.genres.some((genre) => filters.genres.includes(genre)),
    maxRuntime: (item) =>
      filters.maxRuntime === null || (item.runtimeMinutes > 0 && item.runtimeMinutes <= filters.maxRuntime),
    decadeFrom: (item) =>
      filters.decadeFrom === null || (item.year > 0 && decadeOf(item.year) >= filters.decadeFrom),
    decadeTo: (item) =>
      filters.decadeTo === null || (item.year > 0 && decadeOf(item.year) <= filters.decadeTo),
    // Meaningless outside the watchlist, where everything is watched by
    // definition — leaving it live there would empty the wheel.
    excludeWatched: (item) =>
      filters.source !== 'watchlist' || !filters.excludeWatched || !watchedIds.has(item.id),
    rating: (item) =>
      filters.source !== 'rewatch' ||
      matchesRating(item.myRating, filters.ratingMode, filters.ratingValue),
    watchedBefore: (item) =>
      !isWatchedSource(filters.source) ||
      filters.watchedBeforeMonths === null ||
      // Letterboxd doesn't always record a date. Without one there's no
      // evidence the film is recent, so it stays in.
      item.watchedOn === null ||
      monthsSince(item.watchedOn) >= filters.watchedBeforeMonths,
    bothLoved: (item) =>
      filters.source !== 'both-loved' ||
      (item.myRating !== null &&
        item.partnerRating !== null &&
        item.myRating >= filters.bothLovedThreshold &&
        item.partnerRating >= filters.bothLovedThreshold),
  }
}

export function applyFilters(
  pool: WheelItem[],
  filters: WheelFilters,
  watchedIds: Set<string>,
): WheelItem[] {
  const checks = Object.values(predicates(filters, watchedIds))
  return pool.filter((item) => checks.every((check) => check(item)))
}

// Everything except one dimension, so a facet's counts reflect what
// selecting it would actually give you.
function applyFiltersExcept(
  pool: WheelItem[],
  filters: WheelFilters,
  watchedIds: Set<string>,
  except: FilterKey[],
): WheelItem[] {
  const all = predicates(filters, watchedIds)
  const checks = (Object.keys(all) as FilterKey[])
    .filter((key) => !except.includes(key))
    .map((key) => all[key])
  return pool.filter((item) => checks.every((check) => check(item)))
}

export interface Facet {
  value: string
  count: number
}

export function languageFacets(
  pool: WheelItem[],
  filters: WheelFilters,
  watchedIds: Set<string>,
): Facet[] {
  const scoped = applyFiltersExcept(pool, filters, watchedIds, ['languages'])
  const counts = new Map<string, number>()
  for (const item of scoped) {
    if (!item.originalLanguage) continue
    counts.set(item.originalLanguage, (counts.get(item.originalLanguage) ?? 0) + 1)
  }
  // Keep a selected language visible even once its count drops to zero,
  // otherwise it can't be unselected.
  for (const language of filters.languages) {
    if (!counts.has(language)) counts.set(language, 0)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function genreFacets(
  pool: WheelItem[],
  filters: WheelFilters,
  watchedIds: Set<string>,
): Facet[] {
  const scoped = applyFiltersExcept(pool, filters, watchedIds, ['genres'])
  const counts = new Map<string, number>()
  for (const item of scoped) {
    for (const genre of item.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1)
    }
  }
  for (const genre of filters.genres) {
    if (!counts.has(genre)) counts.set(genre, 0)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

export function decadesPresent(pool: WheelItem[]): number[] {
  const decades = new Set<number>()
  for (const item of pool) {
    if (item.year > 0) decades.add(decadeOf(item.year))
  }
  return [...decades].sort((a, b) => a - b)
}

// Longest title in the pool, rounded up to a step — the point past which
// the runtime slider means "no limit".
export function runtimeCeiling(pool: WheelItem[]): number {
  const longest = pool.reduce((max, item) => Math.max(max, item.runtimeMinutes), 0)
  const rounded = Math.ceil(Math.max(longest, RUNTIME_MIN) / RUNTIME_STEP) * RUNTIME_STEP
  return Math.max(rounded, RUNTIME_MIN)
}

function isActive(filters: WheelFilters, key: FilterKey): boolean {
  switch (key) {
    case 'mediaType':
      return filters.mediaType !== 'both'
    case 'languages':
      return filters.languages.length > 0
    case 'genres':
      return filters.genres.length > 0
    case 'maxRuntime':
      return filters.maxRuntime !== null
    case 'decadeFrom':
      return filters.decadeFrom !== null
    case 'decadeTo':
      return filters.decadeTo !== null
    case 'excludeWatched':
      return filters.source === 'watchlist' && filters.excludeWatched
    case 'rating':
      return filters.source === 'rewatch' && filters.ratingMode !== 'any'
    case 'watchedBefore':
      return isWatchedSource(filters.source) && filters.watchedBeforeMonths !== null
    case 'bothLoved':
      return filters.source === 'both-loved' && filters.bothLovedThreshold > RATING_MIN
  }
}

// Names the single filter whose relaxation would let the most titles
// through, so the empty state can point at something specific.
export function mostRestrictiveFilter(
  pool: WheelItem[],
  filters: WheelFilters,
  watchedIds: Set<string>,
): { key: FilterKey; label: string; wouldMatch: number } | null {
  const active = (Object.keys(FILTER_LABELS) as FilterKey[]).filter((key) => isActive(filters, key))
  if (active.length === 0) return null

  let best: { key: FilterKey; label: string; wouldMatch: number } | null = null
  for (const key of active) {
    // Decade is one control with two bounds; relax them together.
    const except: FilterKey[] =
      key === 'decadeFrom' || key === 'decadeTo' ? ['decadeFrom', 'decadeTo'] : [key]
    const wouldMatch = applyFiltersExcept(pool, filters, watchedIds, except).length
    if (!best || wouldMatch > best.wouldMatch) {
      best = { key, label: FILTER_LABELS[key], wouldMatch }
    }
  }
  return best
}
