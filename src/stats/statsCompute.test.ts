import { describe, expect, it } from 'vitest'
import { computeStats, watchedYears } from './statsCompute'
import type { FilmFacts, StatsRaw, WatchedRecord } from './statsCompute'

function facts(overrides: Partial<FilmFacts> = {}): FilmFacts {
  return {
    title: 'Untitled',
    runtime: 120,
    genres: [],
    originalLanguage: 'en',
    mediaType: 'movie',
    posterPath: null,
    topCast: [],
    directors: [],
    countries: [],
    ...overrides,
  }
}

function watch(filmId: string, overrides: Partial<WatchedRecord> = {}): WatchedRecord {
  return { filmId, rating: null, watchedOn: '2024-06-01', together: false, ...overrides }
}

function raw(overrides: Partial<StatsRaw> = {}): StatsRaw {
  return {
    togetherFilmIds: new Set(),
    mine: [],
    theirs: [],
    films: new Map(),
    spins: [],
    spinTitles: new Map(),
    ...overrides,
  }
}

const names = { language: (code: string) => code, country: (code: string) => code }

describe('watchedYears', () => {
  it('lists each year something was watched, newest first, skipping undated watches', () => {
    const data = raw({
      mine: [
        watch('a', { watchedOn: '2022-03-01' }),
        watch('b', { watchedOn: '2024-01-09' }),
        watch('c', { watchedOn: '2022-12-31' }),
        watch('d', { watchedOn: null }),
      ],
    })
    expect(watchedYears(data)).toEqual([2024, 2022])
  })
})

describe('computeStats', () => {
  it('counts only the chosen year, by watched_on', () => {
    const data = raw({
      mine: [
        watch('a', { watchedOn: '2023-05-01' }),
        watch('b', { watchedOn: '2024-05-01' }),
        watch('c', { watchedOn: null }),
      ],
      films: new Map([
        ['a', facts({ runtime: 60 })],
        ['b', facts({ runtime: 90 })],
        ['c', facts({ runtime: 30 })],
      ]),
    })
    const all = computeStats(data, 'all', names)
    expect(all.filmCount).toBe(3)
    expect(all.filmHours).toBe(3)

    const in2024 = computeStats(data, 2024, names)
    expect(in2024.filmCount).toBe(1)
    expect(in2024.filmHours).toBe(1.5)
  })

  it('tells never-fetched cast apart from no cast', () => {
    const data = raw({
      mine: [watch('a'), watch('b'), watch('c')],
      films: new Map([
        ['a', facts({ topCast: null })],
        ['b', facts({ topCast: [{ name: 'Tilda Swinton', profile_path: null }] })],
        ['c', facts({ topCast: [] })],
      ]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.actorCoverage).toEqual({ known: 2, missing: 1 })
    expect(stats.actors).toEqual([{ name: 'Tilda Swinton', profilePath: null, count: 1 }])
  })

  it('ranks people by how many films they are in, keeping the first photo found', () => {
    const data = raw({
      mine: [watch('a'), watch('b'), watch('c')],
      films: new Map([
        ['a', facts({ directors: [{ name: 'Agnès Varda', profile_path: null }] })],
        ['b', facts({ directors: [{ name: 'Agnès Varda', profile_path: '/av.jpg' }] })],
        ['c', facts({ directors: [{ name: 'Chantal Akerman', profile_path: null }] })],
      ]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.directors).toEqual([
      { name: 'Agnès Varda', profilePath: '/av.jpg', count: 2 },
      { name: 'Chantal Akerman', profilePath: null, count: 1 },
    ])
  })

  it('counts countries only from films that have them', () => {
    const data = raw({
      mine: [watch('a'), watch('b')],
      films: new Map([
        ['a', facts({ countries: ['FR', 'BE'] })],
        ['b', facts({ countries: null })],
      ]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.countries.map((c) => c.label).sort()).toEqual(['BE', 'FR'])
    expect(stats.countryCoverage).toEqual({ known: 1, missing: 1 })
  })

  it('never shows a film as both highest and lowest', () => {
    const data = raw({
      mine: [
        watch('a', { rating: 5 }),
        watch('b', { rating: 4 }),
        watch('c', { rating: 4 }),
        watch('d', { rating: 2 }),
      ],
      films: new Map([
        ['a', facts()],
        ['b', facts()],
        ['c', facts()],
        ['d', facts()],
      ]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.highest.map((f) => f.filmId)).toEqual(['a', 'b', 'c'])
    expect(stats.lowest.map((f) => f.filmId)).toEqual(['d'])
  })

  it('leaves lowest empty when every rating is the same', () => {
    const data = raw({
      mine: [watch('a', { rating: 4 }), watch('b', { rating: 4 })],
      films: new Map([
        ['a', facts()],
        ['b', facts()],
      ]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.highest).toHaveLength(2)
    expect(stats.lowest).toEqual([])
  })

  it('compares averages over the films both of us rated, and drops zero gaps from disagreements', () => {
    const data = raw({
      togetherFilmIds: new Set(['a', 'b']),
      mine: [
        watch('a', { rating: 5, together: true }),
        watch('b', { rating: 3, together: true }),
        // Rated by me alone: in my histogram, not in the comparison.
        watch('c', { rating: 1 }),
      ],
      theirs: [watch('a', { rating: 2, together: true }), watch('b', { rating: 3, together: true })],
      films: new Map([
        ['a', facts({ title: 'A' })],
        ['b', facts({ title: 'B' })],
        ['c', facts({ title: 'C' })],
      ]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.bothRatedCount).toBe(2)
    expect(stats.myAverageShared).toBe(4)
    expect(stats.theirAverageShared).toBe(2.5)
    expect(stats.disagreements.map((d) => d.filmId)).toEqual(['a'])
    expect(stats.ratingHistogram.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3)
  })

  it('counts a together film logged only by them as watched by me', () => {
    const data = raw({
      togetherFilmIds: new Set(['a']),
      theirs: [watch('a', { together: true })],
      films: new Map([['a', facts()]]),
    })
    const stats = computeStats(data, 'all', names)
    expect(stats.watchedCount).toBe(1)
    expect(stats.togetherCount).toBe(1)
  })

  it('reads the wheel for the chosen year only', () => {
    const data = raw({
      spins: [
        { filmId: 'x', outcome: 'rerolled', createdAt: '2023-06-01T12:00:00' },
        { filmId: 'y', outcome: 'watched', createdAt: '2023-06-01T12:05:00' },
        { filmId: 'z', outcome: 'rerolled', createdAt: '2024-06-01T12:00:00' },
        { filmId: 'z', outcome: 'rerolled', createdAt: '2024-06-01T12:01:00' },
        { filmId: 'y', outcome: 'watched', createdAt: '2024-06-01T12:02:00' },
      ],
      spinTitles: new Map([
        ['x', 'X'],
        ['z', 'Z'],
      ]),
    })
    const in2023 = computeStats(data, 2023, names).wheel
    expect(in2023.totalSpins).toBe(2)
    expect(in2023.averageRerolls).toBe(1)
    expect(in2023.mostDodged).toEqual({ title: 'X', count: 1 })

    const all = computeStats(data, 'all', names).wheel
    expect(all.totalSpins).toBe(5)
    expect(all.averageRerolls).toBe(1.5)
    expect(all.mostDodged).toEqual({ title: 'Z', count: 2 })
  })
})
