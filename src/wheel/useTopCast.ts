import { useEffect, useState } from 'react'
import { getTopCast, parseFilmId } from '../lib/tmdbClient'
import type { TopCastMember } from '../lib/tmdbClient'
import { saveTopCast } from '../import/watchlistWrites'

// Films already backfilled this session. The row in the database is updated,
// but the WheelItem in memory still carries the null it loaded with, so
// without this the same film would hit TMDB again on every reopen.
const resolved = new Map<string, TopCastMember[]>()

// Lookups still in the air, so two mounts of the same film share one request
// rather than racing. Without it StrictMode alone fires the fetch twice.
const inFlight = new Map<string, Promise<TopCastMember[]>>()

function loadTopCastOnce(
  filmId: string,
  mediaType: 'movie' | 'tv',
  tmdbId: number,
): Promise<TopCastMember[]> {
  const existing = inFlight.get(filmId)
  if (existing) return existing

  const request = getTopCast(mediaType, tmdbId)
    .then((cast) => {
      resolved.set(filmId, cast)
      // Deliberately not awaited: the cast renders the moment TMDB answers
      // and the write catches up behind it. If the write fails, the cast
      // still shows and the next session simply fetches it again.
      void saveTopCast(filmId, cast).catch(() => {})
      return cast
    })
    .finally(() => {
      // Only successes land in `resolved`, so a failed lookup is free to be
      // retried the next time the modal opens.
      inFlight.delete(filmId)
    })

  inFlight.set(filmId, request)
  return request
}

// Films enriched before top_cast existed have null there. Rather than a
// migration pass over the whole library, the cast is fetched the first time
// a modal actually needs it and written back for good.
export function useTopCast(filmId: string, stored: TopCastMember[] | null): TopCastMember[] | null {
  const [fetched, setFetched] = useState<TopCastMember[] | null>(() => resolved.get(filmId) ?? null)
  const [fetchedFor, setFetchedFor] = useState(filmId)

  // The modal usually remounts per result, but don't show one film's cast
  // under another's name if it is ever handed a new item in place.
  if (fetchedFor !== filmId) {
    setFetchedFor(filmId)
    setFetched(resolved.get(filmId) ?? null)
  }

  useEffect(() => {
    if (stored !== null || resolved.has(filmId)) return

    const parsed = parseFilmId(filmId)
    if (!parsed) return

    let cancelled = false
    void loadTopCastOnce(filmId, parsed.mediaType, parsed.tmdbId)
      .then((cast) => {
        if (!cancelled) setFetched(cast)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [filmId, stored])

  return stored ?? fetched
}
