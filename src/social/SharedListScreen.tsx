import { useEffect, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { FilmPicker } from '../wheel/FilmPicker'
import { addToSharedList, loadSharedList, removeFromSharedList } from './sharedList'
import type { SharedListEntry } from './sharedList'

// Two films is the least the wheel can decide between.
const MIN_TO_SPIN = 2

interface SharedListScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  onSpinList: () => void
}

export function SharedListScreen({
  userId,
  partnerId,
  partnerName,
  onSpinList,
}: SharedListScreenProps) {
  const [entries, setEntries] = useState<SharedListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = async () => {
    const rows = await loadSharedList().catch(() => [] as SharedListEntry[])
    setEntries(rows)
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

  if (loading) return null

  const existingIds = new Set(entries.map((entry) => entry.filmId))

  return (
    <div className="list-screen">
      <div className="list-screen-head">
        <h2 className="list-screen-title">Watch together</h2>
        <button
          type="button"
          className="action-button primary list-screen-spin"
          disabled={entries.length < MIN_TO_SPIN}
          onClick={onSpinList}
        >
          Spin this list
        </button>
      </div>

      {entries.length === 1 && (
        <p className="filter-hint">One more film and you can spin this list.</p>
      )}
      {message && <p className="filter-hint">{message}</p>}

      {entries.length === 0 ? (
        <p className="preset-empty">
          Nothing here yet. Anything either of you adds shows up for both.
        </p>
      ) : (
        <ul className="poster-grid">
          {entries.map((entry) => {
            const posterUrl = buildPosterUrl(entry.posterPath)
            return (
              <li className="poster-cell" key={entry.filmId}>
                {posterUrl ? (
                  <img className="poster-cell-image" src={posterUrl} alt={entry.title} />
                ) : (
                  <span className="poster-cell-image poster-cell-fallback">{entry.title}</span>
                )}
                <button
                  type="button"
                  className="poster-cell-remove"
                  onClick={() => void handleRemove(entry)}
                  aria-label={`Remove ${entry.title} from the shared list`}
                >
                  ×
                </button>
                <span className="poster-cell-title">{entry.title}</span>
              </li>
            )
          })}
        </ul>
      )}

      {adding ? (
        <FilmPicker
          userId={userId}
          partnerId={partnerId}
          partnerName={partnerName}
          existingIds={existingIds}
          full={false}
          fullMessage={null}
          onAdd={async (filmId) => {
            await addToSharedList(userId, filmId)
            await refresh()
          }}
        />
      ) : (
        <button
          type="button"
          className="action-button list-screen-add"
          onClick={() => setAdding(true)}
        >
          Add films
        </button>
      )}
    </div>
  )
}
