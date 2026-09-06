import { buildPosterUrl } from '../wheel/posters'
import type { Candidate } from './matching'
import type { ReviewItem } from './EnrichmentContext'

interface ReviewListProps {
  items: ReviewItem[]
  onResolve: (item: ReviewItem, choice: { mediaType: 'movie' | 'tv'; id: number } | 'skip') => void
}

function CandidateButton({ candidate, onClick }: { candidate: Candidate; onClick: () => void }) {
  const posterUrl = buildPosterUrl(candidate.posterPath)
  return (
    <button type="button" className="review-candidate" onClick={onClick}>
      {posterUrl ? (
        <img className="review-candidate-poster" src={posterUrl} alt="" />
      ) : (
        <div className="review-candidate-poster review-candidate-poster-fallback" />
      )}
      <span className="review-candidate-title">{candidate.title}</span>
      <span className="review-candidate-year">{candidate.year ?? '—'}</span>
    </button>
  )
}

export function ReviewList({ items, onResolve }: ReviewListProps) {
  if (items.length === 0) return null

  return (
    <section className="review-list">
      <h2 className="review-list-title">Needs a match ({items.length})</h2>
      {items.map((item) => (
        <div className="review-item" key={item.key}>
          <p className="review-item-source">
            {item.name} {item.year ? `(${item.year})` : ''}
          </p>
          {item.candidates.length > 0 ? (
            <div className="review-candidates">
              {item.candidates.map((candidate) => (
                <CandidateButton
                  key={`${candidate.mediaType}-${candidate.id}`}
                  candidate={candidate}
                  onClick={() => onResolve(item, { mediaType: candidate.mediaType, id: candidate.id })}
                />
              ))}
            </div>
          ) : (
            <p className="review-item-empty">No TMDB results found.</p>
          )}
          <button type="button" className="review-skip" onClick={() => onResolve(item, 'skip')}>
            Skip this title
          </button>
        </div>
      ))}
    </section>
  )
}
