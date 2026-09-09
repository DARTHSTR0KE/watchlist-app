import { useEffect, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { starLabel } from '../wheel/filters'
import { HISTORY_LIMIT, loadHistory } from './watchLog'
import type { HistoryEntry } from './watchLog'

interface HistoryScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string
}

function Score({ label, rating }: { label: string; rating: number | null }) {
  return (
    <div className="score">
      <span className="score-who">{label}</span>
      <span className={`score-value${rating === null ? ' score-value-empty' : ''}`}>
        {rating === null ? '—' : `★ ${starLabel(rating)}`}
      </span>
    </div>
  )
}

export function HistoryScreen({ userId, partnerId, partnerName }: HistoryScreenProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void loadHistory(userId, partnerId)
      .catch(() => [] as HistoryEntry[])
      .then((rows) => {
        if (cancelled) return
        setEntries(rows)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  if (loading) return null

  return (
    <div className="list-screen">
      <h2 className="list-screen-title">History</h2>

      {entries.length === 0 ? (
        <p className="preset-empty">
          Nothing watched yet. Films land here once either of you logs one.
        </p>
      ) : (
        <>
          <ul className="rec-list">
            {entries.map((entry) => {
              const posterUrl = buildPosterUrl(entry.posterPath)
              return (
                <li className="rec-row" key={entry.filmId}>
                  {posterUrl ? (
                    <img className="rec-poster" src={posterUrl} alt="" aria-hidden="true" />
                  ) : (
                    <span className="rec-poster picker-poster-fallback" aria-hidden="true" />
                  )}
                  <div className="rec-body">
                    <p className="rec-title">
                      {entry.title}
                      <span className="picker-year">{entry.year ? ` ${entry.year}` : ''}</span>
                    </p>
                    <p className="rec-outcome">
                      {entry.sortDate || 'no date recorded'}
                      {entry.together ? ' · together' : ''}
                    </p>
                    <div className="score-row">
                      <Score label="You" rating={entry.myRating} />
                      {partnerId && <Score label={partnerName} rating={entry.partnerRating} />}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          {entries.length >= HISTORY_LIMIT && (
            <p className="filter-hint">
              Showing the most recent {HISTORY_LIMIT} from each of you.
            </p>
          )}
        </>
      )}
    </div>
  )
}
