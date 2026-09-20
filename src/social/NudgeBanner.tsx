import type { Nudge } from './nudges'

interface NudgeBannerProps {
  nudge: Nudge
  fromName: string | null
  onDismiss: () => void
}

/**
 * One line at the top of the app, above everything else on the screen.
 * Dismissible and never modal: it is a note, not a thing to get past.
 */
export function NudgeBanner({ nudge, fromName, onDismiss }: NudgeBannerProps) {
  return (
    <div className="nudge-banner" role="status">
      <p className="nudge-text">
        <span className="nudge-from">{fromName ?? 'They'}</span> {nudge.message}
      </p>
      <button type="button" className="nudge-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
