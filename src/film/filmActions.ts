/**
 * What a film's detail sheet offers, by where it was opened from. The
 * wheel's own three (Watch this, Spin again, Not tonight) belong to a spin
 * and live in ResultModal; none of the second two ever appear here.
 */
export type FilmContext =
  // My watchlist.
  | 'watchlist'
  // Something already watched: nothing to do but look, and rate it.
  | 'watched'
  // A hand-made list: the shared list, or a custom wheel.
  | 'list'
  // Sent to me and still waiting for an answer.
  | 'for-me'
  // Anywhere else a poster is only there to be looked at.
  | 'look'

export type FilmActionKind = 'watch' | 'remove-watchlist' | 'remove-list' | 'add-watchlist' | 'pass'

const ACTIONS: Record<FilmContext, readonly FilmActionKind[]> = {
  watchlist: ['watch', 'remove-watchlist'],
  watched: [],
  list: ['watch', 'remove-list'],
  'for-me': ['add-watchlist', 'pass'],
  look: [],
}

export const ACTION_LABEL: Record<FilmActionKind, string> = {
  watch: 'Watch this',
  'remove-watchlist': 'Remove from my watchlist',
  'remove-list': 'Remove from this list',
  'add-watchlist': 'Add to my watchlist',
  pass: 'Pass',
}

export function actionsFor(context: FilmContext): readonly FilmActionKind[] {
  return ACTIONS[context]
}

// Only somewhere it has been watched does rating it on Letterboxd fit.
export function offersLetterboxd(context: FilmContext): boolean {
  return context === 'watched'
}
