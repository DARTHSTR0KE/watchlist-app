/**
 * Where to send someone to rate a film they have just watched.
 *
 * Three ways down, each tried only when the one above it isn't available:
 *
 * 1. The URI Letterboxd itself gave us in the export. Exact, when we have it.
 * 2. letterboxd.com/tmdb/{id}/ — verified to 302 straight to the film page
 *    for films (550 → /film/fight-club/, 27205 → /film/inception/). It does
 *    NOT work for television: Letterboxd doesn't catalogue series, and a TV
 *    id returns 200 on a "TMDB Import Result" interstitial rather than
 *    redirecting, so a status check would not catch it. Films only.
 * 3. A title search, which always lands somewhere usable.
 *
 * None of these can carry a rating — Letterboxd has no public URL that
 * pre-fills one — so this only gets you to the right page.
 */
export function letterboxdUrlFor(film: {
  filmId: string
  title: string
  letterboxdUri: string | null
}): string {
  if (film.letterboxdUri) return film.letterboxdUri

  const [mediaType, tmdbId] = film.filmId.split(':')
  if (mediaType === 'movie' && tmdbId) return `https://letterboxd.com/tmdb/${tmdbId}/`

  return `https://letterboxd.com/search/films/${encodeURIComponent(film.title)}/`
}
