import { describe, expect, it } from 'vitest'
import { ACTION_LABEL, actionsFor, offersLetterboxd } from './filmActions'
import type { FilmContext } from './filmActions'

const labels = (context: FilmContext) => actionsFor(context).map((kind) => ACTION_LABEL[kind])
const CONTEXTS: FilmContext[] = ['watchlist', 'watched', 'list', 'for-me', 'look']

describe('the actions on a film opened from a list', () => {
  it('from the watchlist: watch it, or take it off', () => {
    expect(labels('watchlist')).toEqual(['Watch this', 'Remove from my watchlist'])
  })

  it('from Watched: nothing but close, and the Letterboxd link', () => {
    expect(labels('watched')).toEqual([])
    expect(offersLetterboxd('watched')).toBe(true)
  })

  it('from the shared list or a custom wheel: watch it, or take it off that list', () => {
    expect(labels('list')).toEqual(['Watch this', 'Remove from this list'])
  })

  it('from For me: add it, or pass', () => {
    expect(labels('for-me')).toEqual(['Add to my watchlist', 'Pass'])
  })

  it('never offers the wheel-only actions, anywhere', () => {
    for (const context of CONTEXTS) {
      expect(labels(context).join(' ')).not.toMatch(/Spin again|Not tonight|Not today|Reshuffle/)
    }
  })

  it('offers the Letterboxd link only from Watched', () => {
    expect(CONTEXTS.filter(offersLetterboxd)).toEqual(['watched'])
  })
})
