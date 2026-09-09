import { useEffect, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { loadWatchedTogether } from './pendingWatches'
import type { WatchedTogetherFilm } from './pendingWatches'

interface WatchedTogetherScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
}

export function WatchedTogetherScreen({
  userId,
  partnerId,
  partnerName,
}: WatchedTogetherScreenProps) {
  const [films, setFilms] = useState<WatchedTogetherFilm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadWatchedTogether(userId, partnerId)
      .catch(() => [] as WatchedTogetherFilm[])
      .then((rows) => {
        if (cancelled) return
        setFilms(rows)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  if (loading) return null

  return (
    <div className="list-screen">
      <h2 className="list-screen-title">Watched together</h2>

      {films.length === 0 ? (
        <p className="preset-empty">
          Nothing yet. A film lands here once either you or {partnerName ?? 'they'} answers
          "watched it together" after a spin.
        </p>
      ) : (
        <ul className="poster-grid">
          {films.map((film) => {
            const posterUrl = buildPosterUrl(film.posterPath)
            return (
              <li className="poster-cell" key={film.filmId}>
                {posterUrl ? (
                  <img className="poster-cell-image" src={posterUrl} alt={film.title} />
                ) : (
                  <span className="poster-cell-image poster-cell-fallback">{film.title}</span>
                )}
                <span className="poster-cell-title">{film.title}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
