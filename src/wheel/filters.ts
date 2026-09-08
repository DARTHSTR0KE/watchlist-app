import type { WheelItem } from './titles'

export interface WheelFilters {
  mediaType: 'movie' | 'tv' | 'both'
  // Empty means "no restriction", not "nothing matches".
  languages: string[]
  genres: string[]
  maxRuntime: number | null
  decadeFrom: number | null
  decadeTo: number | null
  excludeWatched: boolean
}

export const DEFAULT_FILTERS: WheelFilters = {
  mediaType: 'both',
  languages: [],
  genres: [],
  maxRuntime: null,
  decadeFrom: null,
  decadeTo: null,
  excludeWatched: false,
}

export const RUNTIME_STEP = 15
export const RUNTIME_MIN = 60

export type FilterKey = keyof WheelFilters

export const FILTER_LABELS: Record<FilterKey, string> = {
  mediaType: 'media type',
  languages: 'language',
  genres: 'genre',
  maxRuntime: 'maximum runtime',
  decadeFrom: 'release decade',
  decadeTo: 'release decade',
  excludeWatched: 'already watched',
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
    excludeWatched: (item) => !filters.excludeWatched || !watchedIds.has(item.id),
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
      return filters.excludeWatched
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
