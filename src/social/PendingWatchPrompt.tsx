import { useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import type { PendingWatch } from './pendingWatches'

export type WatchAnswer = 'together' | 'alone' | 'not-watched'

interface PendingWatchPromptProps {
  // Oldest first; only the first is shown.
  pending: PendingWatch[]
  partnerName: string | null
  onAnswer: (watch: PendingWatch, answer: WatchAnswer) => void
  onDismiss: () => void
}

// Asked on opening the app, one film at a time, because it is a question
// about a specific evening rather than a list to work through. Dismissing
// leaves the queue intact to be asked again next time — it never stands
// between you and the app.
export function PendingWatchPrompt({
  pending,
  partnerName,
  onAnswer,
  onDismiss,
}: PendingWatchPromptProps) {
  const [busy, setBusy] = useState(false)
  const watch = pending[0]
  if (!watch) return null

  const posterUrl = buildPosterUrl(watch.posterPath)

  const answer = (choice: WatchAnswer) => {
    setBusy(true)
    onAnswer(watch, choice)
    setBusy(false)
  }

  return (
    <div className="filter-sheet-overlay" onClick={onDismiss}>
      <div className="filter-sheet pending-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">Did you watch it?</h2>
          {pending.length > 1 && (
            <span className="filter-sheet-count">{pending.length} to answer</span>
          )}
        </div>

        <div className="pending-film">
          {posterUrl ? (
            <img className="pending-poster" src={posterUrl} alt="" aria-hidden="true" />
          ) : (
            <span className="pending-poster picker-poster-fallback" aria-hidden="true" />
          )}
          <p className="pending-title">
            {watch.title}
            <span className="picker-year">{watch.year ? ` ${watch.year}` : ''}</span>
          </p>
        </div>

        <div className="filter-sheet-actions">
          <button
            type="button"
            className="action-button primary"
            disabled={busy}
            onClick={() => answer('together')}
          >
            Watched it with {partnerName ?? 'them'}
          </button>
          <button
            type="button"
            className="action-button"
            disabled={busy}
            onClick={() => answer('alone')}
          >
            Watched it on my own
          </button>
          <button
            type="button"
            className="action-button"
            disabled={busy}
            onClick={() => answer('not-watched')}
          >
            Didn't watch it after all
          </button>
          <button type="button" className="preset-delete pending-later" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
