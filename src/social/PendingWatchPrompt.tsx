import { useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { FilmBackdrop } from '../wheel/FilmBackdrop'
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
    <div className="pending-screen">
      {/* The film's own backdrop, blurred and darkened by the same
          component the wheel uses. No backdrop_path leaves the flat
          background showing through. */}
      <FilmBackdrop backdropPath={watch.backdropPath} variant="contained" />

      <div className="pending-content">
        <p className="pending-question">Did you watch it?</p>

        {posterUrl ? (
          <img className="pending-poster" src={posterUrl} alt="" aria-hidden="true" />
        ) : (
          <span className="pending-poster pending-poster-fallback" aria-hidden="true" />
        )}

        <p className="pending-title">
          {watch.title}
          {watch.year ? <span className="pending-year"> {watch.year}</span> : null}
        </p>
        {pending.length > 1 && <p className="pending-count">1 of {pending.length}</p>}

        {/* Full-width rows in order of likelihood. Never circles: these
            labels carry a name of unknown length. */}
        <div className="pending-actions">
          <button
            type="button"
            className="pending-action pending-action-primary"
            disabled={busy}
            onClick={() => answer('together')}
          >
            Watched it with {partnerName ?? 'them'}
          </button>
          <button
            type="button"
            className="pending-action pending-action-neutral"
            disabled={busy}
            onClick={() => answer('alone')}
          >
            Watched it on my own
          </button>
          {/* Named for what the app will do, not for how the evening went —
              that is the part worth knowing before tapping it. */}
          <button
            type="button"
            className="pending-action pending-action-undo"
            disabled={busy}
            onClick={() => answer('not-watched')}
          >
            Put it back on my watchlist
          </button>
          <button type="button" className="pending-later" onClick={onDismiss}>
            Ask me later
          </button>
        </div>
      </div>
    </div>
  )
}
