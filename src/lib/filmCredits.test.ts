import { describe, expect, it } from 'vitest'
import { extractCountries, extractDirectors } from './filmCredits'

describe('extractDirectors', () => {
  it('takes only the crew whose job is Director, for a film', () => {
    const directors = extractDirectors(
      'movie',
      [
        { name: 'Greta Gerwig', job: 'Director', profile_path: '/gg.jpg' },
        { name: 'Rodrigo Prieto', job: 'Director of Photography', profile_path: null },
        { name: 'Noah Baumbach', job: 'Screenplay', profile_path: '/nb.jpg' },
      ],
      [{ name: 'Someone', profile_path: null }],
    )
    expect(directors).toEqual([{ name: 'Greta Gerwig', profile_path: '/gg.jpg' }])
  })

  it('uses created_by for a show, and ignores the crew', () => {
    const directors = extractDirectors(
      'tv',
      [{ name: 'Episode Director', job: 'Director', profile_path: null }],
      [{ name: 'Phoebe Waller-Bridge', profile_path: '/pwb.jpg' }],
    )
    expect(directors).toEqual([{ name: 'Phoebe Waller-Bridge', profile_path: '/pwb.jpg' }])
  })

  it('lists someone credited twice once', () => {
    const directors = extractDirectors(
      'movie',
      [
        { name: 'Joel Coen', job: 'Director', profile_path: null },
        { name: 'Ethan Coen', job: 'Director', profile_path: null },
        { name: 'Joel Coen', job: 'Director', profile_path: null },
      ],
      undefined,
    )
    expect(directors.map((d) => d.name)).toEqual(['Joel Coen', 'Ethan Coen'])
  })

  it('answers an empty list, not nothing, when there is no one', () => {
    expect(extractDirectors('movie', undefined, undefined)).toEqual([])
    expect(extractDirectors('tv', [], undefined)).toEqual([])
  })
})

describe('extractCountries', () => {
  it('keeps the ISO codes, once each', () => {
    expect(
      extractCountries([
        { iso_3166_1: 'US', name: 'United States of America' },
        { iso_3166_1: 'fr', name: 'France' },
        { iso_3166_1: 'US', name: 'United States of America' },
      ]),
    ).toEqual(['US', 'FR'])
  })

  it('is an empty list when TMDB names none', () => {
    expect(extractCountries(undefined)).toEqual([])
  })
})
