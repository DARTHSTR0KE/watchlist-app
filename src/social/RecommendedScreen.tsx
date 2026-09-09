import { useEffect, useRef, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import {
  loadRecommendationsForMe,
  markRecommendationsSeen,
  respondToRecommendation,
} from './recommendations'
import type { Recommendation } from './recommendations'
import { addExistingFilmToWatchlist, watchFilmNow } from '../import/watchlistWrites'

interface RecommendedScreenProps {
  userId: string
  partnerName: string
  // Lets the shell clear the badge once these have been looked at.
  onSeen: () => void
}

const OUTCOME_LABELS: Record<Recommendation['status'], string> = {
  queued: 'On your watchlist',
  passed: 'Passed',
  watched: 'Marked watched',
}

export function RecommendedScreen({ userId, partnerName, onSeen }: RecommendedScreenProps) {
  const [items, setItems] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Held in a ref so the load effect keys on the user alone; depending on
  // the callback would re-mark everything seen on every render.
  const onSeenRef = useRef(onSeen)
  useEffect(() => {
    onSeenRef.current = onSeen
  })

  useEffect(() => {
    let cancelled = false

    void loadRecommendationsForMe(userId)
      .catch(() => [] as Recommendation[])
      .then(async (loaded) => {
        if (cancelled) return
        setItems(loaded)
        setLoading(false)
        // Opening the screen is what counts as having seen them.
        if (loaded.some((item) => !item.seen)) {
          await markRecommendationsSeen(userId).catch(() => {})
          if (!cancelled) onSeenRef.current()
        }
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const settle = (item: Recommendation, status: Recommendation['status']) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, status, respondedAt: new Date().toISOString() }
          : entry,
      ),
    )
  }

  const revert = (item: Recommendation) => {
    setItems((current) => current.map((entry) => (entry.id === item.id ? item : entry)))
  }

  const handleAdd = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    const { error } = await addExistingFilmToWatchlist(userId, item.filmId)
    // "Already on your watchlist" still means the recommendation is dealt
    // with, so only a real failure leaves it pending.
    if (error && error !== 'Already on your watchlist.') {
      setMessage(`Couldn't add "${item.title}".`)
      setBusyId(null)
      return
    }
    settle(item, 'queued')
    await respondToRecommendation(item.id, 'queued').catch(() => revert(item))
    setMessage(error ? `"${item.title}" was already on your watchlist.` : `Added "${item.title}".`)
    setBusyId(null)
  }

  const handlePass = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    settle(item, 'passed')
    await respondToRecommendation(item.id, 'passed').catch(() => revert(item))
    setBusyId(null)
  }

  const handleWatched = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    settle(item, 'watched')
    try {
      await watchFilmNow(userId, item.filmId)
      await respondToRecommendation(item.id, 'watched')
    } catch {
      revert(item)
      setMessage(`Couldn't mark "${item.title}" watched.`)
    }
    setBusyId(null)
  }

  if (loading) return null

  return (
    <div className="list-screen">
      <h2 className="list-screen-title">Recommended to me</h2>

      {message && <p className="filter-hint">{message}</p>}

      {items.length === 0 ? (
        <p className="preset-empty">
          Nothing yet. Anything {partnerName} recommends will land here.
        </p>
      ) : (
        <ul className="rec-list">
          {items.map((item) => {
            const posterUrl = buildPosterUrl(item.posterPath)
            const handled = item.respondedAt !== null
            return (
              <li className="rec-row" key={item.id}>
                {posterUrl ? (
                  <img className="rec-poster" src={posterUrl} alt="" aria-hidden="true" />
                ) : (
                  <span className="rec-poster picker-poster-fallback" aria-hidden="true" />
                )}

                <div className="rec-body">
                  <p className="rec-title">
                    {item.title}
                    <span className="picker-year">{item.year ? ` ${item.year}` : ''}</span>
                  </p>
                  {item.note ? (
                    <p className="rec-note">“{item.note}”</p>
                  ) : (
                    <p className="rec-note rec-note-empty">No note.</p>
                  )}

                  {handled ? (
                    <p className="rec-outcome">{OUTCOME_LABELS[item.status]}</p>
                  ) : (
                    <div className="rec-actions">
                      <button
                        type="button"
                        className="wheel-row-action"
                        disabled={busyId === item.id}
                        onClick={() => void handleAdd(item)}
                      >
                        Add to my watchlist
                      </button>
                      <button
                        type="button"
                        className="wheel-row-action"
                        disabled={busyId === item.id}
                        onClick={() => void handlePass(item)}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        className="wheel-row-action"
                        disabled={busyId === item.id}
                        onClick={() => void handleWatched(item)}
                      >
                        Mark watched
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
