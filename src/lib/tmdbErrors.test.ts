import { describe, expect, it } from 'vitest'
import { explainTmdbFailure } from './tmdbErrors'

describe('explaining a failed TMDB search', () => {
  it('names a refused key', () => {
    expect(explainTmdbFailure(new Error('TMDB request failed (401): /search/movie'))).toMatch(/refused the app's key/)
  })

  it('names a blocked or missing connection', () => {
    expect(explainTmdbFailure(new TypeError('Failed to fetch'))).toMatch(/Couldn't reach TMDB/)
    // Safari's wording for the same thing.
    expect(explainTmdbFailure(new TypeError('Load failed'))).toMatch(/Couldn't reach TMDB/)
  })

  it('names a request that timed out', () => {
    const timedOut = new Error('signal timed out')
    timedOut.name = 'TimeoutError'
    expect(explainTmdbFailure(timedOut)).toMatch(/took too long/)
  })

  it('gives the status for any other refusal', () => {
    expect(explainTmdbFailure(new Error('TMDB request failed (503): /search/tv'))).toMatch(/\(503\)/)
    expect(explainTmdbFailure(new Error('TMDB request failed (429): /search/tv'))).toMatch(/too many/)
  })

  it('never comes back empty', () => {
    expect(explainTmdbFailure('odd')).toBe('Search failed: odd')
  })
})
