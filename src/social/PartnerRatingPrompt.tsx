import { useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { RatingPicker } from './RatingPicker'
import type { PendingShare } from './watchLog'

interface PartnerRatingPromptProps {
  pending: PendingShare[]
  partnerName: string
  // Settles one film. A null rating still counts as answered.
  onAnswer: (share: PendingShare, rating: number | null) => void
  onClose: () => void
}

function PendingRow({
  share,
  onAnswer,
}: {
  share: PendingShare
  onAnswer: (rating: number | null) => void
}) {
  const [rating, setRating] = useState<number | null>(null)
  const posterUrl = buildPosterUrl(share.posterPath)

  return (
    <li className="rec-row">
      {posterUrl ? (
        <img className="rec-poster" src={posterUrl} alt="" aria-hidden="true" />
      ) : (
        <span className="rec-poster picker-poster-fallback" aria-hidden="true" />
      )}
      <div className="rec-body">
        <p className="rec-title">
          {share.title}
          <span className="picker-year">{share.year ? ` ${share.year}` : ''}</span>
        </p>
        <RatingPicker value={rating} onChange={setRating} />
        <div className="rec-actions">
          <button type="button" className="wheel-row-action" onClick={() => onAnswer(rating)}>
            {rating === null ? 'Save without a rating' : 'Save my rating'}
          </button>
        </div>
      </div>
    </li>
  )
}

// Shown when the partner has logged a shared watch this user hasn't
// answered. Ratings are never shared between the two of us — rewatch mode
// leans on each person having their own.
export function PartnerRatingPrompt({
  pending,
  partnerName,
  onAnswer,
  onClose,
}: PartnerRatingPromptProps) {
  if (pending.length === 0) return null

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">You watched these together</h2>
          <span className="filter-sheet-count">{pending.length}</span>
        </div>

        <p className="filter-hint">
          {partnerName} logged {pending.length === 1 ? 'this' : 'these'} as watched with you. Add
          your own rating — theirs stays theirs.
        </p>

        <ul className="rec-list">
          {pending.map((share) => (
            <PendingRow
              key={share.filmId}
              share={share}
              onAnswer={(rating) => onAnswer(share, rating)}
            />
          ))}
        </ul>

        <div className="filter-sheet-actions">
          <button type="button" className="action-button" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
