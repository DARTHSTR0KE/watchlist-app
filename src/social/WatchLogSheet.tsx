import { useEffect, useState } from 'react'
import { RatingPicker } from './RatingPicker'
import { loadExistingLog, todayLocalDate } from './watchLog'
import type { WatchLogEntry } from './watchLog'

interface WatchLogSheetProps {
  title: string
  userId: string
  filmId: string
  partnerId: string | null
  partnerName: string
  onSave: (entry: WatchLogEntry) => void
  onSkip: () => void
  // Reaching the log means the watch was already written, so backing all
  // the way out has to be reachable from here.
  onUndo: () => void
}

export function WatchLogSheet({
  title,
  userId,
  filmId,
  partnerId,
  partnerName,
  onSave,
  onSkip,
  onUndo,
}: WatchLogSheetProps) {
  const [watchedOn, setWatchedOn] = useState(todayLocalDate)
  const [together, setTogether] = useState(false)
  const [pickedBy, setPickedBy] = useState<string | null>(userId)
  const [rating, setRating] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // A rewatch overwrites the one row this film has, so start from whatever
  // is already recorded rather than silently blanking an old score.
  useEffect(() => {
    let cancelled = false
    void loadExistingLog(userId, filmId)
      .catch(() => null)
      .then((existing) => {
        if (cancelled || !existing) return
        setTogether(existing.together)
        setPickedBy(existing.pickedBy ?? userId)
        if (existing.rating !== null) setRating(existing.rating)
      })
    return () => {
      cancelled = true
    }
  }, [userId, filmId])

  return (
    <div className="filter-sheet-overlay" onClick={onSkip}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">Log it</h2>
          <span className="filter-sheet-count">{title}</span>
        </div>

        <section className="filter-group">
          <p className="filter-group-title">When</p>
          <input
            className="filter-preset-input log-date"
            type="date"
            value={watchedOn}
            max={todayLocalDate()}
            onChange={(event) => setWatchedOn(event.target.value || todayLocalDate())}
          />
        </section>

        <section className="filter-group">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={together}
              onChange={(event) => setTogether(event.target.checked)}
            />
            {partnerId ? `Watched it with ${partnerName}` : 'Watched it together'}
          </label>
          {together && partnerId && (
            <p className="filter-hint">
              {partnerName} will be asked for their own rating — yours is only ever yours.
            </p>
          )}
        </section>

        <section className="filter-group">
          <p className="filter-group-title">Who picked it</p>
          <div className="filter-chips">
            <button
              type="button"
              className={`filter-chip${pickedBy === userId ? ' filter-chip-selected' : ''}`}
              aria-pressed={pickedBy === userId}
              onClick={() => setPickedBy(userId)}
            >
              Me
            </button>
            {partnerId && (
              <button
                type="button"
                className={`filter-chip${pickedBy === partnerId ? ' filter-chip-selected' : ''}`}
                aria-pressed={pickedBy === partnerId}
                onClick={() => setPickedBy(partnerId)}
              >
                {partnerName}
              </button>
            )}
            <button
              type="button"
              className={`filter-chip${pickedBy === null ? ' filter-chip-selected' : ''}`}
              aria-pressed={pickedBy === null}
              onClick={() => setPickedBy(null)}
            >
              The wheel
            </button>
          </div>
        </section>

        <section className="filter-group">
          <p className="filter-group-title">My rating</p>
          <RatingPicker value={rating} onChange={setRating} />
        </section>

        <div className="filter-sheet-actions">
          <button
            type="button"
            className="action-button primary"
            disabled={saving}
            onClick={() => {
              setSaving(true)
              onSave({ watchedOn, together, pickedBy, rating })
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="action-button" onClick={onSkip}>
            Skip
          </button>
          <button type="button" className="preset-delete log-undo" onClick={onUndo}>
            Didn't watch it after all
          </button>
        </div>
      </div>
    </div>
  )
}
