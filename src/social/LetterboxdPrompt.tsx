import { buildPosterUrl } from '../wheel/posters'
import { FilmBackdrop } from '../wheel/FilmBackdrop'
import { letterboxdUrlFor } from './letterboxdLink'
import type { PendingWatch } from './pendingWatches'

interface LetterboxdPromptProps {
  watch: PendingWatch
  onDone: () => void
}

/**
 * The step after the watch question. Same film, same layout — this is the
 * second half of one exchange, not a new screen to get your bearings on.
 *
 * Neither answer writes a rating. There is no public Letterboxd URL that
 * pre-fills one, so all this can do is open the right page.
 */
export function LetterboxdPrompt({ watch, onDone }: LetterboxdPromptProps) {
  const posterUrl = buildPosterUrl(watch.posterPath)

  return (
    <div className="pending-screen">
      <FilmBackdrop backdropPath={watch.backdropPath} variant="contained" />

      <div className="pending-content">
        <p className="pending-question">Rate it?</p>

        {posterUrl ? (
          <img className="pending-poster" src={posterUrl} alt="" aria-hidden="true" />
        ) : (
          <span className="pending-poster pending-poster-fallback" aria-hidden="true" />
        )}

        <p className="pending-title">
          {watch.title}
          {watch.year ? <span className="pending-year"> {watch.year}</span> : null}
        </p>

        <div className="pending-actions">
          {/* An anchor rather than a button: on Android the Letterboxd app
              claims letterboxd.com links, and a real link is what hands the
              URL to whatever is registered for it. */}
          <a
            className="pending-action pending-action-primary"
            href={letterboxdUrlFor(watch)}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onDone}
          >
            Rate it on Letterboxd
          </a>
          {/* Not "Skip": you have either done it or you are about to. */}
          <button
            type="button"
            className="pending-action pending-action-neutral"
            onClick={onDone}
          >
            Already rated it
          </button>
        </div>
      </div>
    </div>
  )
}
