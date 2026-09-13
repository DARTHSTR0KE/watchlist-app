import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { buildPosterUrl } from './posters'
import { loadWatchedPicker, loadWatchlistPicker } from './customWheels'
import type { PickerFilm } from './customWheels'
import {
  loadFilmography,
  searchPeopleByName,
  searchTmdb,
  topByPopularity,
} from '../import/tmdbSearch'
import type {
  CreditResult,
  Filmography,
  ManualResult,
  PersonResult,
} from '../import/tmdbSearch'
import { ensureFilmStored, loadWatchlistFilmIds } from '../import/watchlistWrites'
import { buildFilmId } from '../lib/tmdbClient'

type AddSource = 'search' | 'people' | 'watchlist' | 'watched' | 'partner'

// A film chosen but not yet acted on. `source` is present when it may not
// be in the films table, so a caller can enrich it at the moment it
// commits rather than on every search result.
export interface PickedFilm {
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  source: { mediaType: 'movie' | 'tv'; tmdbId: number } | null
}

// One tap adds a person's best work. A custom wheel holds twelve, so
// there is no point offering more.
const TOP_N = 12

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
  // Adding acts immediately. Selecting hands the film back and does
  // nothing else — no enrichment, no write — for flows that ask another
  // question before committing.
  onAdd?: (filmId: string) => Promise<void>
  onSelect?: (film: PickedFilm) => void
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
  onSelect,
}: FilmPickerProps) {
  const [addSource, setAddSource] = useState<AddSource>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ManualResult[]>([])
  const [searching, setSearching] = useState(false)
  const [picker, setPicker] = useState<PickerFilm[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonResult[]>([])
  const [person, setPerson] = useState<PersonResult | null>(null)
  const [filmography, setFilmography] = useState<Filmography | null>(null)
  const [onWatchlist, setOnWatchlist] = useState<ReadonlySet<string>>(new Set())

  // Switching tab clears and flags the list; the effect below fills it.
  // Only the TMDB tab waits for a query — the rest are plain table reads.
  const chooseSource = (next: AddSource) => {
    if (next === addSource) return
    setAddSource(next)
    setPicker([])
    setPickerLoading(next !== 'search' && next !== 'people')
    setMessage(null)
    setPeople([])
    setPerson(null)
    setFilmography(null)
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

  // Only so a filmography can show what is already mine. Marking, never
  // writing: nothing in this component touches a watchlist.
  useEffect(() => {
    if (addSource !== 'people') return
    let cancelled = false
    void loadWatchlistFilmIds(userId)
      .catch(() => new Set<string>())
      .then((ids) => {
        if (!cancelled) setOnWatchlist(ids)
      })
    return () => {
      cancelled = true
    }
  }, [addSource, userId])

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

  // A TMDB result is enriched only at the moment it is added. Selecting
  // hands it back untouched — nothing is fetched or written for a film
  // that is merely being looked at.
  const handleTmdbResult = async (result: ManualResult) => {
    const filmId = buildFilmId(result.mediaType, result.id)
    if (onSelect) {
      onSelect({
        filmId,
        title: result.title,
        year: result.year,
        posterPath: result.posterPath,
        source: { mediaType: result.mediaType, tmdbId: result.id },
      })
      return
    }
    if (guardFull()) return
    setBusyId(filmId)
    setMessage(null)
    try {
      const stored = await ensureFilmStored(result.mediaType, result.id)
      await onAdd?.(stored)
      setMessage(`${doneLabel} "${result.title}".`)
    } catch {
      setMessage(`Couldn't do that with "${result.title}".`)
    }
    setBusyId(null)
  }

  const handleAddExisting = async (film: PickerFilm) => {
    if (onSelect) {
      onSelect({
        filmId: film.id,
        title: film.title,
        year: film.year,
        posterPath: film.posterPath,
        source: null,
      })
      return
    }
    if (guardFull()) return
    setBusyId(film.id)
    setMessage(null)
    try {
      await onAdd?.(film.id)
      setMessage(`${doneLabel} "${film.title}".`)
    } catch {
      setMessage(`Couldn't do that with "${film.title}".`)
    }
    setBusyId(null)
  }

  const handlePersonSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setMessage(null)
    setPerson(null)
    setFilmography(null)
    setPeople(await searchPeopleByName(query).catch(() => [] as PersonResult[]))
    setSearching(false)
  }

  const openPerson = async (choice: PersonResult) => {
    setPerson(choice)
    setFilmography(null)
    setMessage(null)
    setFilmography(await loadFilmography(choice.id).catch(() => ({ acting: [], directing: [] })))
  }

  // The whole point of the shortcut: a wheel holds twelve, so offer the
  // twelve that matter. Only what fits is added, and only those are
  // enriched.
  const addTopTwelve = async () => {
    if (!filmography || !onAdd) return
    setBusyId('top')
    setMessage(null)
    const candidates = topByPopularity(filmography, TOP_N).filter(
      (c) => !existingIds.has(buildFilmId(c.mediaType, c.id)),
    )
    let added = 0
    for (const credit of candidates) {
      try {
        const stored = await ensureFilmStored(credit.mediaType, credit.id)
        await onAdd(stored)
        added += 1
      } catch {
        break
      }
    }
    setMessage(added === 0 ? 'Nothing new to add.' : `${doneLabel} ${added} films.`)
    setBusyId(null)
  }

  const sources: { value: AddSource; label: string; available: boolean }[] = [
    { value: 'search', label: 'Search TMDB', available: true },
    { value: 'people', label: 'By person', available: true },
    { value: 'watchlist', label: 'My watchlist', available: true },
    { value: 'watched', label: 'My history', available: true },
    {
      value: 'partner',
      label: partnerName ? `${partnerName}'s history` : 'Their history',
      available: partnerId !== null,
    },
  ]

  const creditRow = (credit: CreditResult) => {
    const filmId = buildFilmId(credit.mediaType, credit.id)
    return (
      <li className="picker-row" key={filmId}>
        <PosterThumb posterPath={credit.posterPath} />
        <span className="picker-title">
          {credit.title}
          <span className="picker-year">
            {credit.year ? ` ${credit.year}` : ''} · {credit.mediaType === 'tv' ? 'TV' : 'Film'}
          </span>
          {/* Marking only — this never adds to a watchlist. */}
          {onWatchlist.has(filmId) && <span className="picker-flag">On my watchlist</span>}
        </span>
        <button
          type="button"
          className="wheel-row-action"
          disabled={existingIds.has(filmId) || full || busyId === filmId}
          onClick={() => void handleTmdbResult(credit)}
        >
          {addLabel(filmId)}
        </button>
      </li>
    )
  }

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

      {addSource === 'people' ? (
        <>
          <form className="filter-save-row filter-chips-tight" onSubmit={handlePersonSearch}>
            <input
              className="filter-preset-input"
              type="search"
              placeholder="Search actors and directors"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="filter-save-button" disabled={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {person === null ? (
            <ul className="picker-list picker-list-tall">
              {people.map((entry) => (
                <li className="picker-row" key={entry.id}>
                  <PosterThumb posterPath={entry.profilePath} />
                  <span className="picker-title">
                    {entry.name}
                    {entry.department && <span className="picker-year"> {entry.department}</span>}
                  </span>
                  <button
                    type="button"
                    className="wheel-row-action"
                    onClick={() => void openPerson(entry)}
                  >
                    Films
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <div className="picker-person-head">
                <span className="picker-person-name">{person.name}</span>
                <button
                  type="button"
                  className="onboard-quiet"
                  onClick={() => {
                    setPerson(null)
                    setFilmography(null)
                  }}
                >
                  Someone else
                </button>
              </div>

              {filmography === null ? (
                <p className="preset-empty">Loading their films…</p>
              ) : filmography.acting.length === 0 && filmography.directing.length === 0 ? (
                <p className="preset-empty">TMDB lists no films for them.</p>
              ) : (
                <>
                  {onAdd && (
                    <button
                      type="button"
                      className="action-button settings-wide"
                      disabled={full || busyId === 'top'}
                      onClick={() => void addTopTwelve()}
                    >
                      {busyId === 'top' ? 'Adding…' : `Add their top ${TOP_N}`}
                    </button>
                  )}

                  {/* Both groups when they both exist, each labelled, so a
                      person who acts and directs reads as one person. */}
                  {filmography.acting.length > 0 && (
                    <>
                      <p className="picker-group-title">As actor</p>
                      <ul className="picker-list picker-list-tall">
                        {filmography.acting.map(creditRow)}
                      </ul>
                    </>
                  )}
                  {filmography.directing.length > 0 && (
                    <>
                      <p className="picker-group-title">As director</p>
                      <ul className="picker-list picker-list-tall">
                        {filmography.directing.map(creditRow)}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      ) : addSource === 'search' ? (
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
                    onClick={() => void handleTmdbResult(result)}
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
