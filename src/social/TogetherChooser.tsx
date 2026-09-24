import { useEffect, useState } from 'react'
import { Empty, PosterCell, PosterGrid, Row, Rows, Screen } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { DriftingGround } from '../ui/Ground'
import { TINT } from '../ui/posterColor'
import { ScreenCharacter } from '../brand/Ambient'
import { reportQuietly } from '../lib/dbError'
import { possessiveName } from '../utils/names'
import type { TogetherMode } from '../wheel/filters'
import { loadSharedList } from './sharedList'
import type { SharedListEntry } from './sharedList'
import { comparedToLastYear, loadTogetherWatched, plural, togetherByYear } from './ticketFacts'

interface TogetherChooserProps {
  partnerId: string | null
  partnerName: string | null
  sharedCount: number | null
  onChoose: (mode: TogetherMode) => void
  // The shared list still needs somewhere to be added to.
  onEditSharedList: () => void
}

/**
 * A chooser, not a list. Picking one of these builds the wheel and goes
 * straight to it — deciding how to fill a wheel and then having to
 * navigate to it is two steps for one intention. The shared list itself
 * sits underneath as posters, to look at rather than manage.
 */
export function TogetherChooser({
  partnerId,
  partnerName,
  sharedCount,
  onChoose,
  onEditSharedList,
}: TogetherChooserProps) {
  const [entries, setEntries] = useState<SharedListEntry[] | null>(null)
  const [byYear, setByYear] = useState<Map<number, number> | null>(null)

  useEffect(() => {
    if (!partnerId) return
    let cancelled = false
    void loadSharedList()
      .catch((error: unknown) => {
        reportQuietly('Loading the shared list', error)
        return [] as SharedListEntry[]
      })
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
    void loadTogetherWatched()
      .then((rows) => {
        if (!cancelled) setByYear(togetherByYear(rows))
      })
      .catch((error: unknown) => reportQuietly('Counting films watched together', error))
    return () => {
      cancelled = true
    }
  }, [partnerId])

  const ground = <DriftingGround left={TINT.amber} right={TINT.rust} />

  if (!partnerId) {
    return (
      <Screen ground={ground}>
        <Ticket heading="TOGETHER" figure="—" line="No partner is linked to this account" />
        <Empty art="raccoon">There is nobody to watch with yet.</Empty>
      </Screen>
    )
  }

  const year = new Date().getFullYear()
  const thisYear = byYear?.get(year) ?? 0
  const lastYear = byYear?.get(year - 1) ?? 0
  const count = entries?.length ?? sharedCount

  const options: { mode: TogetherMode; name: string; meta: string }[] = [
    {
      mode: 'ours',
      name: 'Our list',
      meta:
        count === null
          ? 'The films you have both added'
          : `${plural(count, 'film')} you have both added`,
    },
    { mode: 'theirs', name: `From ${possessiveName(partnerName)} watchlist`, meta: 'Something they are waiting on' },
    { mode: 'mix', name: 'Mix', meta: 'Half each, drawn from both watchlists' },
  ]

  return (
    <Screen ground={ground} character={<ScreenCharacter kind="pair" />}>
      <Ticket
        heading="TOGETHER"
        figure={count === null ? '…' : `${count} on the list`}
        line={
          byYear === null
            ? 'Counting what you watched side by side'
            : `${plural(thisYear, 'film')} watched side by side this year`
        }
        perforation={byYear === null ? undefined : comparedToLastYear(thisYear, lastYear)}
      />

      <Rows>
        {options.map((option) => (
          <Row
            key={option.mode}
            name={option.name}
            meta={option.meta}
            onOpen={() => onChoose(option.mode)}
          />
        ))}
      </Rows>

      <button type="button" className="btn-field" onClick={onEditSharedList}>
        Add to our list
      </button>

      {entries && entries.length > 0 && (
        <PosterGrid>
          {entries.map((entry) => (
            <PosterCell key={entry.filmId} posterPath={entry.posterPath} title={entry.title} />
          ))}
        </PosterGrid>
      )}
    </Screen>
  )
}
