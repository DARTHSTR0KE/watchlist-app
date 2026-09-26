import { Mascot } from '../brand/Mascot'
import type { Mascot as MascotName } from '../brand/mascots'
interface NudgeBannerProps {
  // What follows their name: a nudge they wrote, or a record of mine they
  // beat.
  message: string
  fromName: string | null
  // Read from their profiles row by the caller. Never assumed here.
  fromMascot: MascotName | null
  onDismiss: () => void
}

/**
 * One line at the top of the app, above everything else on the screen.
 * Dismissible and never modal: it is a note, not a thing to get past.
 */
export function NudgeBanner({ message, fromName, fromMascot, onDismiss }: NudgeBannerProps) {
  return (
    <div className="nudge-banner" role="status">
      {/* Leaning in from the side of the screen, as though it brought the
          message over itself. */}
      <span className="nudge-mascot">
        <Mascot who={fromMascot} size={30} bowl />
      </span>
      <p className="nudge-text">
        <span className="nudge-from">{fromName ?? 'They'}</span> {message}
      </p>
      <button type="button" className="nudge-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
