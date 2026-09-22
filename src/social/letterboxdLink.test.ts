import { describe, expect, it } from 'vitest'
import { letterboxdUrlFor } from './letterboxdLink'

const base = { filmId: 'movie:550', title: 'Fight Club', letterboxdUri: null as string | null }

describe('where a film sends you on Letterboxd', () => {
  it('uses the stored URI when the export gave us one', () => {
    expect(
      letterboxdUrlFor({ ...base, letterboxdUri: 'https://letterboxd.com/film/fight-club/' }),
    ).toBe('https://letterboxd.com/film/fight-club/')
  })

  it('prefers the stored URI over the tmdb route, even for a film', () => {
    const url = letterboxdUrlFor({ ...base, letterboxdUri: 'https://letterboxd.com/film/ran/' })
    expect(url).not.toContain('/tmdb/')
  })

  it('falls back to the tmdb route for a film', () => {
    expect(letterboxdUrlFor(base)).toBe('https://letterboxd.com/tmdb/550/')
  })

  /**
   * The one that matters. /tmdb/{id}/ redirects to the film page for films
   * but answers 200 on an import interstitial for a series, so a status
   * check would never catch it — television has to skip the route entirely.
   */
  it('never uses the tmdb route for television', () => {
    const url = letterboxdUrlFor({
      filmId: 'tv:1399',
      title: 'Game of Thrones',
      letterboxdUri: null,
    })
    expect(url).not.toContain('/tmdb/')
    expect(url).toBe('https://letterboxd.com/search/films/Game%20of%20Thrones/')
  })

  it('still honours a stored URI for television', () => {
    const url = letterboxdUrlFor({
      filmId: 'tv:1399',
      title: 'Game of Thrones',
      letterboxdUri: 'https://letterboxd.com/film/game-of-thrones/',
    })
    expect(url).toBe('https://letterboxd.com/film/game-of-thrones/')
  })

  it('searches when the id is malformed rather than building a broken route', () => {
    expect(letterboxdUrlFor({ filmId: 'movie:', title: 'Untitled', letterboxdUri: null })).toBe(
      'https://letterboxd.com/search/films/Untitled/',
    )
    expect(letterboxdUrlFor({ filmId: 'nonsense', title: 'Untitled', letterboxdUri: null })).toBe(
      'https://letterboxd.com/search/films/Untitled/',
    )
  })

  it('escapes a title so slashes and ampersands cannot rewrite the path', () => {
    const url = letterboxdUrlFor({
      filmId: 'tv:9',
      title: 'Am\u00e9lie & Co / Part 2',
      letterboxdUri: null,
    })
    expect(url).toBe('https://letterboxd.com/search/films/Am%C3%A9lie%20%26%20Co%20%2F%20Part%202/')
  })

  it('treats an empty stored URI as absent rather than sending you nowhere', () => {
    expect(letterboxdUrlFor({ ...base, letterboxdUri: '' })).toBe('https://letterboxd.com/tmdb/550/')
  })
})
