import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { buildPosterUrl } from './posters'
import { CUSTOM_WHEEL_MAX, loadWatchedPicker, loadWatchlistPicker } from './customWheels'
import type { CustomWheel, PickerFilm } from './customWheels'
import { searchTmdb } from '../import/tmdbSearch'
import type { ManualResult } from '../import/tmdbSearch'
import { resolveCandidate } from '../import/matching'
import { upsertFilm } from '../import/watchlistWrites'
import { buildFilmId } from '../lib/tmdbClient'
import type { WheelItem } from './titles'

type AddSource = 'search' | 'watchlist' | 'watched' | 'partner'

interface CustomWheelEditorProps {
  wheel: CustomWheel
  films: WheelItem[]
  userId: string
  partnerId: string | null
  partnerName: string
  onAddFilmId: (filmId: string) => Promise<void>
  onRemoveFilmId: (filmId: string) => void
  onBack: () => void
}

function PosterThumb({ posterPath, alt }: { posterPath: string | null; alt: string }) {
  const url = buildPosterUrl(posterPath)
  return url ? (
    <img className="picker-poster" src={url} alt={alt} />
  ) : (
    <span className="picker-poster picker-poster-fallback" aria-hidden="true" />
  )
}

export function CustomWheelEditor({
  wheel,
  films,
  userId,
  partnerId,
  partnerName,
  onAddFilmId,
  onRemoveFilmId,
  onBack,
}: CustomWheelEditorProps) {
  const [addSource, setAddSource] = useState<AddSource>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ManualResult[]>([])
  const [searching, setSearching] = useState(false)
  const [picker, setPicker] = useState<PickerFilm[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onWheel = new Set(films.map((film) => film.id))
  const full = films.length >= CUSTOM_WHEEL_MAX

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
    const found = await searchTmdb(query).catch(() => [] as ManualResult[])
    setResults(found)
    setSearching(false)
  }

  const guardFull = (): boolean => {
    if (!full) return false
    setMessage(`A wheel holds ${CUSTOM_WHEEL_MAX} films. Remove one to add another.`)
    return true
  }

  // Straight from TMDB: enrich and write the film exactly as import does,
  // but only onto this wheel — never onto a watchlist.
  const handleAddFromSearch = async (result: ManualResult) => {
    if (guardFull()) return
    const filmId = buildFilmId(result.mediaType, result.id)
    setBusyId(filmId)
    setMessage(null)
    try {
      const film = await resolveCandidate(result.mediaType, result.id)
      await upsertFilm(film)
      await onAddFilmId(film.id)
      setMessage(`Added "${result.title}".`)
    } catch {
      setMessage(`Couldn't add "${result.title}".`)
    }
    setBusyId(null)
  }

  const handleAddExisting = async (film: PickerFilm) => {
    if (guardFull()) return
    setBusyId(film.id)
    setMessage(null)
    try {
      await onAddFilmId(film.id)
      setMessage(`Added "${film.title}".`)
    } catch {
      setMessage(`Couldn't add "${film.title}".`)
    }
    setBusyId(null)
  }

  const sources: { value: AddSource; label: string; available: boolean }[] = [
    { value: 'search', label: 'Search TMDB', available: true },
    { value: 'watchlist', label: 'My watchlist', available: true },
    { value: 'watched', label: 'My history', available: true },
    { value: 'partner', label: `${partnerName}'s history`, available: partnerId !== null },
  ]

  return (
    <div className="filter-sheet-overlay" onClick={onBack}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">{wheel.name}</h2>
          <span className="filter-sheet-count">
            {films.length} of {CUSTOM_WHEEL_MAX}
          </span>
        </div>

        <section className="filter-group">
          <p className="filter-group-title">On this wheel</p>
          {films.length === 0 ? (
            <p className="preset-empty">Nothing on it yet.</p>
          ) : (
            <ul className="picker-list">
              {films.map((film) => (
                <li className="picker-row" key={film.id}>
                  <PosterThumb posterPath={film.posterPath} alt="" />
                  <span className="picker-title">
                    {film.title}
                    <span className="picker-year">{film.year > 0 ? ` ${film.year}` : ''}</span>
                  </span>
                  {/* Permanent, unlike "Not tonight". */}
                  <button
                    type="button"
                    className="preset-delete"
                    onClick={() => onRemoveFilmId(film.id)}
                    aria-label={`Remove ${film.title} from this wheel`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="filter-group">
          <p className="filter-group-title">Add films</p>
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

          {full && <p className="filter-hint">This wheel is full at {CUSTOM_WHEEL_MAX} films.</p>}
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
                  const already = onWheel.has(filmId)
                  return (
                    <li className="picker-row" key={filmId}>
                      <PosterThumb posterPath={result.posterPath} alt="" />
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
                        disabled={already || full || busyId === filmId}
                        onClick={() => void handleAddFromSearch(result)}
                      >
                        {already ? 'On wheel' : busyId === filmId ? 'Adding…' : 'Add'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <ul className="picker-list picker-list-tall">
              {pickerLoading && <li className="preset-empty">Loading…</li>}
              {!pickerLoading && picker.length === 0 && <li className="preset-empty">Nothing here yet.</li>}
              {picker.map((film) => {
                const already = onWheel.has(film.id)
                return (
                  <li className="picker-row" key={film.id}>
                    <PosterThumb posterPath={film.posterPath} alt="" />
                    <span className="picker-title">
                      {film.title}
                      <span className="picker-year">{film.year ? ` ${film.year}` : ''}</span>
                    </span>
                    <button
                      type="button"
                      className="wheel-row-action"
                      disabled={already || full || busyId === film.id}
                      onClick={() => void handleAddExisting(film)}
                    >
                      {already ? 'On wheel' : busyId === film.id ? 'Adding…' : 'Add'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="filter-sheet-actions">
          <button type="button" className="action-button primary" onClick={onBack}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
