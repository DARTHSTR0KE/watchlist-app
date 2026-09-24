import { subjectName } from '../utils/names'

/**
 * On 1 December, and again on the 7th and 13th while nothing has been
 * left. Dismissing is always fine; it never asks more than those three
 * times.
 */
export function GiftPrompt({
  partnerName,
  onLeaveSomething,
  onDismiss,
}: {
  partnerName: string | null
  onLeaveSomething: () => void
  onDismiss: () => void
}) {
  const them = subjectName(partnerName)
  return (
    <div className="pending-screen gift-prompt" role="dialog" aria-label="For their Wrapped">
      <div className="pending-content">
        <p className="pending-question">
          Your Wrapped arrives on the 15th. Between now and then, leave two things for {them} — a
          song to play behind it, and a message they'll see at the end.
        </p>
        <div className="pending-actions">
          <button
            type="button"
            className="pending-action pending-action-primary"
            onClick={onLeaveSomething}
          >
            Leave something for {partnerName ?? 'them'}
          </button>
          <button type="button" className="pending-action" onClick={onDismiss}>
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
