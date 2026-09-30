/**
 * What to tell someone when a TMDB search fails, instead of showing an
 * empty list that looks exactly like "no such film". Pure, so it can be
 * tested without an API key.
 */
export function explainTmdbFailure(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const status = /TMDB request failed \((\d{3})\)/.exec(text)?.[1]
  if (status === '401') return "TMDB refused the app's key (401). The key set in Vercel may be wrong or expired."
  if (status === '429') return 'TMDB says too many searches at once (429). Wait a moment and try again.'
  if (status) return `TMDB answered with an error (${status}). Try again in a moment.`
  // fetch() rejects without a status when the request never got an answer:
  // no connection, or the network blocking api.themoviedb.org outright.
  if (error instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(text)) {
    return "Couldn't reach TMDB. The connection may be down, or this network may be blocking api.themoviedb.org. Some mobile networks do; try Wi-Fi."
  }
  return `Search failed: ${text}`
}
