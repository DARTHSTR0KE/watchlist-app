import { useEffect, useState } from 'react'
import { IdleScene } from '../brand/PairScene'
import { ScreenCharacter } from '../brand/Ambient'
import { Empty, Loading, PosterCell, PosterGrid, Screen, SectionLabel } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { Ground } from '../ui/Ground'
import { TINT, usePosterColors } from '../ui/posterColor'
import { FilmPicker } from '../wheel/FilmPicker'
import {
  addExistingFilmToWatchlist,
  getLastImportDate,
  getWatchlistGrid,
  removeFromWatchlist,
} from '../import/watchlistWrites'
import type { WatchlistGridItem } from '../import/watchlistWrites'

interface WatchlistScreenProps {
  userId: string
  partnerId: string | null
  onGoToImport: () => void
}

function lastImportedLine(at: string | null): string {
  if (!at) return 'Never imported'
  const date = new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `Last imported ${date}`
}

/** My watchlist, newest first, to look at and change by hand. */
export function WatchlistScreen({ userId, partnerId, onGoToImport }: WatchlistScreenProps) {
  const [items, setItems] = useState<WatchlistGridItem[] | null>(null)
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = async () => {
    setItems(await getWatchlistGrid(userId))
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([getWatchlistGrid(userId), getLastImportDate(userId).catch(() => null)])
      .then(([rows, imported]) => {
        if (cancelled) return
        setItems(rows)
        setLastImportedAt(imported)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // The newest film colours the screen.
  const newestColor = usePosterColors(items ? [items[0]?.posterPath] : [])
  const ground = <Ground tints={newestColor && newestColor.length > 0 ? newestColor : [TINT.amber]} />
  const character = (
    <IdleScene busy={items === null || adding} fallback={<ScreenCharacter kind="raccoon" />} />
  )

  if (failed) {
    return (
      <Screen ground={ground}>
        <Ticket heading="YOUR WATCHLIST" figure="—" line="Couldn't be read" />
        <Empty>Your watchlist couldn't be loaded. Check the connection and open this again.</Empty>
      </Screen>
    )
  }

  if (items === null) {
    return (
      <Screen ground={ground}>
        <Ticket heading="YOUR WATCHLIST" figure="…" line="Fetching your films" />
        <Loading art="raccoon">Fetching your films…</Loading>
      </Screen>
    )
  }

  const handleRemove = async (item: WatchlistGridItem) => {
    const previous = items
    setItems((current) => (current ?? []).filter((row) => row.filmId !== item.filmId))
    setMessage(null)
    try {
      await removeFromWatchlist(userId, item.filmId)
    } catch {
      setItems(previous)
      setMessage(`Couldn't remove "${item.title}".`)
    }
  }

  const existingIds = new Set(items.map((item) => item.filmId))

  return (
    <Screen ground={ground} character={character}>
      <Ticket
        heading="YOUR WATCHLIST"
        figure={`${items.length} film${items.length === 1 ? '' : 's'}`}
        line={lastImportedLine(lastImportedAt)}
      />

      {message && <Empty>{message}</Empty>}

      <section>
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
                const { error } = await addExistingFilmToWatchlist(userId, filmId)
                if (error) throw new Error(error)
                await refresh()
              }}
            />
            <button type="button" className="btn-field" onClick={() => setAdding(false)}>
              Done
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            Add a film
          </button>
        )}
      </section>

      {items.length === 0 ? (
        <>
          <Empty art="raccoon">
            Nothing on your watchlist yet. Add a film above, or bring your whole list across from
            Letterboxd.
          </Empty>
          <button type="button" className="btn-field" onClick={onGoToImport}>
            Import from Letterboxd
          </button>
        </>
      ) : (
        <PosterGrid>
          {items.map((item) => (
            <PosterCell
              key={item.filmId}
              posterPath={item.posterPath}
              title={item.title}
              onRemove={() => void handleRemove(item)}
              removeLabel={`Remove ${item.title} from your watchlist`}
            />
          ))}
        </PosterGrid>
      )}
    </Screen>
  )
}
