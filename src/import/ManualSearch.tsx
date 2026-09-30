import { useState } from 'react'
import type { FormEvent } from 'react'
import { searchTmdb } from './tmdbSearch'
import type { ManualResult } from './tmdbSearch'
import { resolveCandidate } from './matching'
import { addManualWatchlistItem } from './watchlistWrites'
import { buildPosterUrl } from '../wheel/posters'
import { explainTmdbFailure } from '../lib/tmdbErrors'

interface ManualSearchProps {
  userId: string
  onAdded: () => void
}

export function ManualSearch({ userId, onAdded }: ManualSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ManualResult[]>([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setMessage(null)

    // Caught, so a failure says what failed instead of leaving the button
    // stuck on "Searching…" with nothing to show.
    try {
      const found = await searchTmdb(query)
      setResults(found)
      if (found.length === 0) setMessage(`Nothing on TMDB for "${query.trim()}".`)
    } catch (error) {
      setResults([])
      setMessage(explainTmdbFailure(error))
    }
    setSearching(false)
  }

  const handleAdd = async (result: ManualResult) => {
    setAddingId(result.id)
    setMessage(null)
    let error: string | null
    try {
      const film = await resolveCandidate(result.mediaType, result.id)
      error = (await addManualWatchlistItem(userId, film)).error
    } catch (failure) {
      error = explainTmdbFailure(failure)
    }
    setAddingId(null)
    if (error) {
      setMessage(error)
    } else {
      setMessage(`Added "${result.title}".`)
      onAdded()
    }
  }

  return (
    <section className="manual-search">
      <h2 className="manual-search-title">Add something not on Letterboxd</h2>
      <form className="manual-search-form" onSubmit={handleSearch}>
        <input
          className="manual-search-input"
          type="search"
          placeholder="Search movies and TV shows"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="manual-search-button" disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {message && <p className="manual-search-message">{message}</p>}

      {results.length > 0 && (
        <div className="manual-search-results">
          {results.map((result) => {
            const posterUrl = buildPosterUrl(result.posterPath)
            return (
              <div className="manual-search-result" key={`${result.mediaType}-${result.id}`}>
                {posterUrl ? (
                  <img className="manual-search-poster" src={posterUrl} alt="" />
                ) : (
                  <div className="manual-search-poster manual-search-poster-fallback" />
                )}
                <span className="manual-search-result-title">{result.title}</span>
                <span className="manual-search-result-year">
                  {result.year ?? '—'} · {result.mediaType === 'tv' ? 'TV' : 'Movie'}
                </span>
                <button
                  type="button"
                  className="manual-search-add"
                  onClick={() => handleAdd(result)}
                  disabled={addingId === result.id}
                >
                  {addingId === result.id ? 'Adding…' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
