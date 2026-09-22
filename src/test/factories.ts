import type { WheelItem } from '../wheel/titles'

/**
 * A film with everything filled in, so a test only has to state the one or
 * two properties it is actually about.
 */
export function film(overrides: Partial<WheelItem> & { id: string }): WheelItem {
  return {
    title: overrides.id,
    posterPath: null,
    backdropPath: null,
    year: 2000,
    runtimeMinutes: 100,
    genres: [],
    rating: 0,
    synopsis: '',
    trailerKey: null,
    topCast: null,
    mediaType: 'movie',
    originalLanguage: 'en',
    addedAt: null,
    ...overrides,
  }
}

/**
 * A deterministic generator, because "older titles come up more often" is a
 * claim about a distribution and Math.random would make the test fail a few
 * runs in a hundred for no reason anyone could act on.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    // xorshift32
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0x100000000
  }
}
