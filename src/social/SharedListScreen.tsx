import { useEffect, useState } from 'react'
import { Empty, Loading, PosterCell, PosterGrid, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
import { FilmPicker } from '../wheel/FilmPicker'
import { addToSharedList, loadSharedList, removeFromSharedList } from './sharedList'
import type { SharedListEntry } from './sharedList'

// Two films is the least the wheel can decide between.
const MIN_TO_SPIN = 2

interface SharedListScreenProps {
  userId: string
  partnerId: string | null
  onSpinList: () => void
}

export function SharedListScreen({
  userId,
  partnerId,
  onSpinList,
}: SharedListScreenProps) {
  const [entries, setEntries] = useState<SharedListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = async () => {
    setEntries(await loadSharedList().catch(() => [] as SharedListEntry[]))
  }

  useEffect(() => {
    let cancelled = false
    void loadSharedList()
      .catch(() => [] as SharedListEntry[])
      .then((rows) => {
        if (cancelled) return
        setEntries(rows)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleRemove = async (entry: SharedListEntry) => {
    const previous = entries
    setEntries((current) => current.filter((row) => row.filmId !== entry.filmId))
    setMessage(null)
    try {
      await removeFromSharedList(entry.filmId)
    } catch {
      setEntries(previous)
      setMessage(`Couldn't remove "${entry.title}".`)
    }
  }

  if (loading) {
    return (
      <Screen>
        <ScreenHead title="Watch together" />
        <Loading>Fetching your list…</Loading>
      </Screen>
    )
  }

  const existingIds = new Set(entries.map((entry) => entry.filmId))

  return (
    <Screen>
      <ScreenHead title="Watch together" status={`${entries.length}`} />

      {message && <Empty>{message}</Empty>}

      {entries.length === 0 ? (
        <Empty art="goldfish">Nothing here yet. Anything either of you adds shows up for both.</Empty>
      ) : (
        <PosterGrid>
          {entries.map((entry) => (
            <PosterCell
              key={entry.filmId}
              posterPath={entry.posterPath}
              title={entry.title}
              onRemove={() => void handleRemove(entry)}
              removeLabel={`Remove ${entry.title} from the shared list`}
            />
          ))}
        </PosterGrid>
      )}

      {/* The one amber button on this screen. */}
      <button
        type="button"
        className="btn-primary"
        disabled={entries.length < MIN_TO_SPIN}
        onClick={onSpinList}
      >
        Spin this list
      </button>
      {entries.length === 1 && <Empty>One more film and you can spin it.</Empty>}

      {adding ? (
        <>
          <SectionLabel>Add a film</SectionLabel>
          <FilmPicker
            userId={userId}
            partnerId={partnerId}
            existingIds={existingIds}
            full={false}
            fullMessage={null}
            title="Find it"
            onAdd={async (filmId) => {
              await addToSharedList(userId, filmId)
              await refresh()
            }}
          />
        </>
      ) : (
        <button type="button" className="btn-field" onClick={() => setAdding(true)}>
          Add a film
        </button>
      )}
    </Screen>
  )
}
