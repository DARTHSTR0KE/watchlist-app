import { useEffect, useState } from 'react'
import { Empty, PosterCell, PosterGrid, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
import { loadWatchedFilms } from './pendingWatches'
import type { WatchedFilm } from './pendingWatches'

interface WatchedScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
}

export function WatchedTogetherScreen({ userId, partnerId, partnerName }: WatchedScreenProps) {
  const [films, setFilms] = useState<WatchedFilm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadWatchedFilms(userId, partnerId)
      .catch(() => [] as WatchedFilm[])
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

  const them = partnerName ?? 'them'
  const togetherCount = films.filter((film) => film.together).length

  return (
    <Screen>
      <ScreenHead title="Watched" status={`${films.length}`} />

      {films.length === 0 ? (
        <Empty>Nothing watched yet. Films land here once one of you logs one.</Empty>
      ) : (
        <>
          {/* One grid, marked, rather than two tabs holding the same films
              split by a single fact about them. */}
          <SectionLabel tone="sage">
            ★ {togetherCount} watched with {them}
          </SectionLabel>
          <PosterGrid>
            {films.map((film) => (
              <PosterCell
                key={film.filmId}
                posterPath={film.posterPath}
                title={film.title}
                marked={film.together}
                markLabel={`Watched with ${them}`}
              />
            ))}
          </PosterGrid>
        </>
      )}
    </Screen>
  )
}
