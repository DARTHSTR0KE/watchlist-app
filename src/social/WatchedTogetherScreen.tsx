import { useEffect, useState } from 'react'
import { IdleScene } from '../brand/PairScene'
import { Empty, Loading, PosterCell, PosterGrid, Screen, SectionLabel } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { Ground } from '../ui/Ground'
import { TINT, usePosterColors } from '../ui/posterColor'
import { ScreenCharacter } from '../brand/Ambient'
import { yearOf } from './ticketFacts'
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

  const year = new Date().getFullYear()
  const heading = `WATCHED · ${year}`
  // Whatever was watched last colours the screen.
  const newest = split
    ? [...split.together, ...split.alone].sort((a, b) =>
        (b.watchedOn ?? '').localeCompare(a.watchedOn ?? ''),
      )[0]
    : undefined
  const newestColor = usePosterColors([newest?.posterPath])
  const ground = (
    <Ground tints={newestColor && newestColor.length > 0 ? newestColor : [TINT.sage]} />
  )

  if (split === null) {
    return (
      <Screen ground={ground}>
        <Ticket heading={heading} figure="…" line="Counting what you've seen" />
        <Loading>Counting what you've seen…</Loading>
      </Screen>
    )
  }

  const them = partnerName ?? 'them'
  const total = split.together.length + split.aloneTotal
  const togetherThisYear = split.together.filter((film) => yearOf(film.watchedOn) === year).length
  const aloneThisYear = split.alone.filter((film) => yearOf(film.watchedOn) === year).length
  const thisYear = togetherThisYear + aloneThisYear

  return (
    <Screen
      ground={ground}
      character={<IdleScene busy={false} fallback={<ScreenCharacter kind="fish-asleep" />} />}
    >
      <Ticket
        heading={heading}
        figure={`${thisYear} film${thisYear === 1 ? '' : 's'}`}
        line={`${togetherThisYear} with ${them}`}
        perforation="THREE-SECOND MEMORY. THAT IS WHY WE KEEP A LIST."
      />

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
