import { useEffect, useState } from 'react'
import { Empty, Loading, PosterCell, PosterGrid, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
import { MomentLine } from '../brand/Moments'
import { SleepingPairMoment } from '../brand/Ambient'
import { MascotPair } from '../brand/Mascot'
import { loadWatchedSplit } from './pendingWatches'
import type { WatchedSplit } from './pendingWatches'

interface WatchedScreenProps {
  userId: string
  partnerName: string | null
}

export function WatchedTogetherScreen({ userId, partnerName }: WatchedScreenProps) {
  const [split, setSplit] = useState<WatchedSplit | null>(null)
  const [aloneOpen, setAloneOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadWatchedSplit(userId)
      .catch(() => ({ together: [], alone: [], aloneTotal: 0 }) as WatchedSplit)
      .then((rows) => {
        if (!cancelled) setSplit(rows)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (split === null) {
    return (
      <Screen>
        <ScreenHead title="Watched" />
        <Loading>Counting what you've seen…</Loading>
      </Screen>
    )
  }

  const them = partnerName ?? 'them'
  const total = split.together.length + split.aloneTotal

  return (
    <Screen>
      <ScreenHead title="Watched" status={`${total}`} />

      {/* Both of them asleep here — this is where the evenings went. */}
      <MomentLine art={<SleepingPairMoment />}>
        Three-second memory. That's why we keep a list.
      </MomentLine>

      {total === 0 ? (
        <Empty art="pair">Nothing watched yet. Films land here once one of you logs one.</Empty>
      ) : (
        <>
          {/* The shared half leads: it is the same list and the same count
              for both of us, whoever answered the prompt. */}
          <SectionLabel tone="sage">
            <MascotPair size={22} /> Together · {split.together.length}
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
            <span className="section-label tone-amber">On your own · {split.aloneTotal}</span>
            <span className="disclosure-mark" aria-hidden="true">
              {aloneOpen ? '−' : '+'}
            </span>
          </button>
          {aloneOpen &&
            (split.alone.length === 0 ? (
              <Empty>Nothing here — everything you have watched was together.</Empty>
            ) : (
              <>
                <PosterGrid>
                  {split.alone.map((film) => (
                    <PosterCell key={film.filmId} posterPath={film.posterPath} title={film.title} />
                  ))}
                </PosterGrid>
                {/* Said out loud rather than quietly showing a shorter list. */}
                {split.alone.length < split.aloneTotal && (
                  <Empty>Showing the most recent {split.alone.length}.</Empty>
                )}
              </>
            ))}
        </>
      )}
    </Screen>
  )
}
