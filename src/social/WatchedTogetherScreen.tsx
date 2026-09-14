import { useEffect, useState } from 'react'
import { Empty, PosterCell, PosterGrid, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
import { loadWatchedSplit } from './pendingWatches'
import type { WatchedSplit } from './pendingWatches'

interface WatchedScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
}

export function WatchedTogetherScreen({ userId, partnerId, partnerName }: WatchedScreenProps) {
  const [split, setSplit] = useState<WatchedSplit | null>(null)
  const [aloneOpen, setAloneOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadWatchedSplit(userId, partnerId)
      .catch(() => ({ together: [], alone: [] }) as WatchedSplit)
      .then((rows) => {
        if (!cancelled) setSplit(rows)
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  if (split === null) return null

  const them = partnerName ?? 'them'
  const total = split.together.length + split.alone.length

  return (
    <Screen>
      <ScreenHead title="Watched" status={`${total}`} />

      {total === 0 ? (
        <Empty>Nothing watched yet. Films land here once one of you logs one.</Empty>
      ) : (
        <>
          {/* The shared half leads: it is the same list and the same count
              for both of us, whoever answered the prompt. */}
          <SectionLabel tone="sage">
            Together · {split.together.length}
          </SectionLabel>
          {split.together.length === 0 ? (
            <Empty>Nothing you have watched together yet.</Empty>
          ) : (
            <PosterGrid>
              {split.together.map((film) => (
                <PosterCell
                  key={film.filmId}
                  posterPath={film.posterPath}
                  title={film.title}
                  marked
                  markLabel={`Watched with ${them}`}
                />
              ))}
            </PosterGrid>
          )}

          {/* Folded away: only ever my own, and the part I look at least. */}
          <button
            type="button"
            className="disclosure"
            aria-expanded={aloneOpen}
            onClick={() => setAloneOpen((open) => !open)}
          >
            <span className="section-label tone-amber">On your own · {split.alone.length}</span>
            <span className="disclosure-mark" aria-hidden="true">
              {aloneOpen ? '−' : '+'}
            </span>
          </button>
          {aloneOpen &&
            (split.alone.length === 0 ? (
              <Empty>Nothing here — everything you have watched was together.</Empty>
            ) : (
              <PosterGrid>
                {split.alone.map((film) => (
                  <PosterCell key={film.filmId} posterPath={film.posterPath} title={film.title} />
                ))}
              </PosterGrid>
            ))}
        </>
      )}
    </Screen>
  )
}
