import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { buildPosterUrl } from './posters'
import { loadWatchedPicker, loadWatchlistPicker } from './customWheels'
import type { PickerFilm } from './customWheels'
import { searchTmdb } from '../import/tmdbSearch'
import type { ManualResult } from '../import/tmdbSearch'
import { resolveCandidate } from '../import/matching'
import { upsertFilm } from '../import/watchlistWrites'
import { buildFilmId } from '../lib/tmdbClient'

type AddSource = 'search' | 'watchlist' | 'watched' | 'partner'

interface FilmPickerProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  // What is already there, so it can be shown as such rather than offered.
  existingIds: ReadonlySet<string>
  // Set when the destination can take no more; the message says why.
  full: boolean
  fullMessage: string | null
  // What the section and its buttons are called. Adding to a list and
  // sending to someone are the same pick with a different verb.
  title?: string
  actionLabel?: string
  doneLabel?: string
  onAdd: (filmId: string) => Promise<void>
}

function PosterThumb({ posterPath }: { posterPath: string | null }) {
  const url = buildPosterUrl(posterPath)
  return url ? (
    <img className="picker-poster" src={url} alt="" aria-hidden="true" />
  ) : (
    <span className="picker-poster picker-poster-fallback" aria-hidden="true" />
  )
}

// The four ways a film gets onto a hand-made list: straight off TMDB, or
// out of one of the three lists we already keep. Shared by the custom wheel
// editor and the watch together list, which pick films identically.
export function FilmPicker({
  userId,
  partnerId,
  partnerName,
  existingIds,
  full,
  fullMessage,
  title = 'Add films',
  actionLabel = 'Add',
  doneLabel = 'Added',
  onAdd,
}: FilmPickerProps) {
  const [addSource, setAddSource] = useState<AddSource>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ManualResult[]>([])
  const [searching, setSearching] = useState(false)
  const [picker, setPicker] = useState<PickerFilm[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Switching tab clears and flags the list; the effect below fills it.
  // Only the TMDB tab waits for a query — the rest are plain table reads.
  const chooseSource = (next: AddSource) => {
    if (next === addSource) return
    setAddSource(next)
    setPicker([])
    setPickerLoading(next !== 'search')
    setMessage(null)
  }

  useEffect(() => {
    if (addSource === 'search') return
    let cancelled = false

    const load = (): Promise<PickerFilm[]> => {
      if (addSource === 'watchlist') return loadWatchlistPicker(userId)
      if (addSource === 'watched') return loadWatchedPicker(userId)
      return partnerId ? loadWatchedPicker(partnerId) : Promise.resolve([])
    }

    void load()
      .catch(() => [] as PickerFilm[])
      .then((rows) => {
        if (cancelled) return
        setPicker(rows)
        setPickerLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [addSource, userId, partnerId])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setMessage(null)
    setResults(await searchTmdb(query).catch(() => [] as ManualResult[]))
    setSearching(false)
  }

  const guardFull = (): boolean => {
    if (!full) return false
    if (fullMessage) setMessage(fullMessage)
    return true
  }

  // Straight from TMDB: enrich and write the film exactly as import does,
  // but only onto this list — never onto a watchlist.
  const handleAddFromSearch = async (result: ManualResult) => {
    if (guardFull()) return
    setBusyId(buildFilmId(result.mediaType, result.id))
    setMessage(null)
    try {
      const film = await resolveCandidate(result.mediaType, result.id)
      await upsertFilm(film)
      await onAdd(film.id)
      setMessage(`${doneLabel} "${result.title}".`)
    } catch {
      setMessage(`Couldn't do that with "${result.title}".`)
    }
    setBusyId(null)
  }

  const handleAddExisting = async (film: PickerFilm) => {
    if (guardFull()) return
    setBusyId(film.id)
    setMessage(null)
    try {
      await onAdd(film.id)
      setMessage(`${doneLabel} "${film.title}".`)
    } catch {
      setMessage(`Couldn't do that with "${film.title}".`)
    }
    setBusyId(null)
  }

  const sources: { value: AddSource; label: string; available: boolean }[] = [
    { value: 'search', label: 'Search TMDB', available: true },
    { value: 'watchlist', label: 'My watchlist', available: true },
    { value: 'watched', label: 'My history', available: true },
    {
      value: 'partner',
      label: partnerName ? `${partnerName}'s history` : 'Their history',
      available: partnerId !== null,
    },
  ]

  const addLabel = (filmId: string) =>
    existingIds.has(filmId) ? doneLabel : busyId === filmId ? '…' : actionLabel

  return (
    <section className="filter-group">
      <p className="filter-group-title">{title}</p>
      <div className="filter-chips">
        {sources
          .filter((entry) => entry.available)
          .map((entry) => (
            <button
              key={entry.value}
              type="button"
              className={`filter-chip${addSource === entry.value ? ' filter-chip-selected' : ''}`}
              aria-pressed={addSource === entry.value}
              onClick={() => chooseSource(entry.value)}
            >
              {entry.label}
            </button>
          ))}
      </div>

      {full && fullMessage && <p className="filter-hint">{fullMessage}</p>}
      {message && <p className="filter-hint">{message}</p>}

      {addSource === 'search' ? (
        <>
          <form className="filter-save-row filter-chips-tight" onSubmit={handleSearch}>
            <input
              className="filter-preset-input"
              type="search"
              placeholder="Search movies and TV shows"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="filter-save-button" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          <ul className="picker-list">
            {results.map((result) => {
              const filmId = buildFilmId(result.mediaType, result.id)
              return (
                <li className="picker-row" key={filmId}>
                  <PosterThumb posterPath={result.posterPath} />
                  <span className="picker-title">
                    {result.title}
                    <span className="picker-year">
                      {result.year ? ` ${result.year}` : ''} ·{' '}
                      {result.mediaType === 'tv' ? 'TV' : 'Film'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="wheel-row-action"
                    disabled={existingIds.has(filmId) || full || busyId === filmId}
                    onClick={() => void handleAddFromSearch(result)}
                  >
                    {addLabel(filmId)}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <ul className="picker-list picker-list-tall">
          {pickerLoading && <li className="preset-empty">Loading…</li>}
          {!pickerLoading && picker.length === 0 && (
            <li className="preset-empty">Nothing here yet.</li>
          )}
          {picker.map((film) => (
            <li className="picker-row" key={film.id}>
              <PosterThumb posterPath={film.posterPath} />
              <span className="picker-title">
                {film.title}
                <span className="picker-year">{film.year ? ` ${film.year}` : ''}</span>
              </span>
              <button
                type="button"
                className="wheel-row-action"
                disabled={existingIds.has(film.id) || full || busyId === film.id}
                onClick={() => void handleAddExisting(film)}
              >
                {addLabel(film.id)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
