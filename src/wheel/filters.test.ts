import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  applyFilters,
  decadeOf,
  decadesPresent,
  genreFacets,
  languageFacets,
  mostRestrictiveFilter,
  runtimeCeiling,
} from './filters'
import type { WheelFilters } from './filters'
import { film } from '../test/factories'

const none = new Set<string>()
const withFilters = (over: Partial<WheelFilters>): WheelFilters => ({ ...DEFAULT_FILTERS, ...over })

const pool = [
  film({ id: 'a', mediaType: 'movie', originalLanguage: 'ml', genres: ['Drama'], runtimeMinutes: 95, year: 2019 }),
  film({ id: 'b', mediaType: 'movie', originalLanguage: 'ml', genres: ['Drama', 'Thriller'], runtimeMinutes: 150, year: 2003 }),
  film({ id: 'c', mediaType: 'tv', originalLanguage: 'en', genres: ['Comedy'], runtimeMinutes: 42, year: 2021 }),
  film({ id: 'd', mediaType: 'movie', originalLanguage: 'ja', genres: ['Horror'], runtimeMinutes: 119, year: 1998 }),
  film({ id: 'e', mediaType: 'movie', originalLanguage: null, genres: [], runtimeMinutes: 0, year: 0 }),
]
const ids = (items: { id: string }[]) => items.map((item) => item.id).sort()

describe('filters', () => {
  it('let everything through by default', () => {
    expect(ids(applyFilters(pool, DEFAULT_FILTERS, none))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('narrow to one medium', () => {
    expect(ids(applyFilters(pool, withFilters({ mediaType: 'tv' }), none))).toEqual(['c'])
    expect(ids(applyFilters(pool, withFilters({ mediaType: 'movie' }), none))).toEqual(['a', 'b', 'd', 'e'])
  })

  it('treat an empty language list as no restriction, not as nothing matches', () => {
    expect(applyFilters(pool, withFilters({ languages: [] }), none)).toHaveLength(pool.length)
  })

  it('match any of several languages, and exclude titles with none recorded', () => {
    expect(ids(applyFilters(pool, withFilters({ languages: ['ml', 'ja'] }), none))).toEqual(['a', 'b', 'd'])
  })

  it('match a title carrying any one of the chosen genres', () => {
    expect(ids(applyFilters(pool, withFilters({ genres: ['Thriller', 'Comedy'] }), none))).toEqual(['b', 'c'])
  })

  /**
   * A runtime of zero means unknown, not instant. Letting it through an
   * "under 100 minutes" filter would put a three-hour film on the wheel.
   */
  it('exclude titles of unknown length from a runtime limit', () => {
    // 'e' runs zero minutes, meaning nobody knows, and is the one that has
    // to be kept out. 'b' at 150 is simply too long.
    expect(ids(applyFilters(pool, withFilters({ maxRuntime: 100 }), none))).toEqual(['a', 'c'])
  })

  it('include a title exactly at the runtime limit', () => {
    // 'a' is 95 on the nose; 'c' at 42 is comfortably under.
    expect(ids(applyFilters(pool, withFilters({ maxRuntime: 95 }), none))).toEqual(['a', 'c'])
  })

  it('bound decades inclusively at both ends, and exclude unknown years', () => {
    // 2019 rounds to the 2010s, which an inclusive upper bound of 2010
    // takes in.
    expect(ids(applyFilters(pool, withFilters({ decadeFrom: 2000, decadeTo: 2010 }), none))).toEqual(['a', 'b'])
    expect(ids(applyFilters(pool, withFilters({ decadeFrom: 1990 }), none))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(applyFilters(pool, withFilters({ decadeTo: 1990 }), none))).toEqual(['d'])
  })

  it('round a year down to its decade', () => {
    expect(decadeOf(1998)).toBe(1990)
    expect(decadeOf(2000)).toBe(2000)
    expect(decadeOf(2019)).toBe(2010)
  })

  it('drop watched titles only on the watchlist, where the toggle means something', () => {
    const watched = new Set(['a', 'b'])
    const on = withFilters({ source: 'watchlist', excludeWatched: true })
    expect(ids(applyFilters(pool, on, watched))).toEqual(['c', 'd', 'e'])

    // A hand-built wheel is exactly what was put on it, so the toggle has
    // nothing to say there.
    const custom = withFilters({ source: 'custom', excludeWatched: true })
    expect(applyFilters(pool, custom, watched)).toHaveLength(pool.length)
  })

  it('combine dimensions with and, not or', () => {
    const filters = withFilters({ mediaType: 'movie', languages: ['ml'], maxRuntime: 100 })
    expect(ids(applyFilters(pool, filters, none))).toEqual(['a'])
  })
})

describe('facet counts', () => {
  it('count what choosing a value would actually give you, ignoring that dimension', () => {
    const filters = withFilters({ languages: ['ml'] })
    const facets = languageFacets(pool, filters, none)
    expect(facets.find((f) => f.value === 'ml')?.count).toBe(2)
    expect(facets.find((f) => f.value === 'ja')?.count).toBe(1)
    expect(facets.find((f) => f.value === 'en')?.count).toBe(1)
  })

  it('respect the other dimensions while ignoring their own', () => {
    const filters = withFilters({ mediaType: 'movie', languages: ['ml'] })
    const facets = languageFacets(pool, filters, none)
    expect(facets.find((f) => f.value === 'en')).toBeUndefined()
    expect(facets.find((f) => f.value === 'ja')?.count).toBe(1)
  })

  it('keep a selected value visible at zero, so it can be unselected', () => {
    const filters = withFilters({ mediaType: 'tv', languages: ['ml'] })
    const facets = languageFacets(pool, filters, none)
    expect(facets.find((f) => f.value === 'ml')).toEqual({ value: 'ml', count: 0 })
  })

  it('count a title once per genre it carries', () => {
    const facets = genreFacets(pool, DEFAULT_FILTERS, none)
    expect(facets.find((f) => f.value === 'Drama')?.count).toBe(2)
    expect(facets.find((f) => f.value === 'Thriller')?.count).toBe(1)
  })

  it('order facets by count, then alphabetically for a stable list', () => {
    const facets = genreFacets(pool, DEFAULT_FILTERS, none)
    expect(facets.map((f) => f.value)).toEqual(['Drama', 'Comedy', 'Horror', 'Thriller'])
  })

  it('list the decades present, in order, ignoring unknown years', () => {
    expect(decadesPresent(pool)).toEqual([1990, 2000, 2010, 2020])
  })
})

describe('the runtime ceiling', () => {
  it('clears the longest title in the pool', () => {
    expect(runtimeCeiling(pool)).toBeGreaterThanOrEqual(150)
  })

  it('never drops below the floor, even for a pool of short things', () => {
    expect(runtimeCeiling([film({ id: 'x', runtimeMinutes: 20 })])).toBe(60)
    expect(runtimeCeiling([])).toBe(60)
  })

  it('lands on a step of the slider', () => {
    expect(runtimeCeiling(pool) % 15).toBe(0)
  })
})

describe('naming the filter that is doing the damage', () => {
  it('names nothing when nothing is set', () => {
    expect(mostRestrictiveFilter(pool, DEFAULT_FILTERS, none)).toBeNull()
  })

  it('names the one whose relaxation would let the most through', () => {
    const filters = withFilters({ languages: ['ml'], maxRuntime: 200 })
    expect(mostRestrictiveFilter(pool, filters, none)?.key).toBe('languages')
  })

  it('relaxes both decade bounds together, since they are one control', () => {
    const filters = withFilters({ decadeFrom: 2020, decadeTo: 2020 })
    const worst = mostRestrictiveFilter(pool, filters, none)
    expect(worst?.wouldMatch).toBe(pool.length)
  })
})
