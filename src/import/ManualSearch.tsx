import { useState } from 'react'
import type { FormEvent } from 'react'
import { searchMovies, searchTv, yearFromDate } from '../lib/tmdbClient'
import { resolveCandidate } from './matching'
import { addManualWatchlistItem } from './watchlistWrites'
import { buildPosterUrl } from '../wheel/posters'

interface ManualResult {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  year: number | null
  posterPath: string | null
}

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

    const [movies, tv] = await Promise.all([searchMovies(query), searchTv(query)])
    const movieResults: ManualResult[] = movies.slice(0, 10).map((r) => ({
      id: r.id,
      mediaType: 'movie',
      title: r.title,
      year: yearFromDate(r.release_date),
      posterPath: r.poster_path,
    }))
    const tvResults: ManualResult[] = tv.slice(0, 10).map((r) => ({
      id: r.id,
      mediaType: 'tv',
      title: r.name,
      year: yearFromDate(r.first_air_date),
      posterPath: r.poster_path,
    }))

    setResults([...movieResults, ...tvResults])
    setSearching(false)
  }

  const handleAdd = async (result: ManualResult) => {
    setAddingId(result.id)
    setMessage(null)
    const film = await resolveCandidate(result.mediaType, result.id)
    const { error } = await addManualWatchlistItem(userId, film)
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
