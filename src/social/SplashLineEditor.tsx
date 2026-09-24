import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  LineLockedThisMonth,
  SPLASH_LINE_MAX,
  canChangeLine,
  nextChangeLabel,
  saveLine,
} from './splashLines'
import type { SplashLine } from './splashLines'
import { describeError } from '../lib/dbError'

/**
 * Writing their line, the same wherever it is done. On the prompt it sits
 * where the tagline does and looks like it; in Settings it is an ordinary
 * field. Either way it shows what was set last time and, once set, when it
 * can next change.
 */
export function SplashLineEditor({
  userId,
  partnerId,
  current,
  onSaved,
  variant,
  secondary,
}: {
  userId: string
  partnerId: string
  // What I set for them last time, if anything.
  current: SplashLine | null
  onSaved: (line: SplashLine) => void
  variant: 'splash' | 'settings'
  // Beside the save button — the prompt's skip.
  secondary?: ReactNode
}) {
  const [draft, setDraft] = useState(current?.line ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const locked = current !== null && !canChangeLine(current.setAt)
  const trimmed = draft.trim()
  const changed = trimmed.length > 0 && trimmed !== current?.line
  const count = draft.length

  const handleSave = async () => {
    if (!changed || saving) return
    setSaving(true)
    setMessage(null)
    try {
      const saved = await saveLine(userId, partnerId, trimmed)
      onSaved(saved)
    } catch (error) {
      // A lock is expected and explained; anything else says what the
      // database said.
      setMessage(
        error instanceof LineLockedThisMonth
          ? "It's already been changed this month."
          : `Couldn't save that: ${describeError(error)}`,
      )
    }
    setSaving(false)
  }

  const splash = variant === 'splash'

  if (locked) {
    return (
      <div className={splash ? 'line-editor line-editor-splash' : 'line-editor'}>
        <p className={splash ? 'splash-tag line-locked-splash' : 'line-current'}>{current.line}</p>
        <div className="line-below">
          <p className="line-meta">
            You can change this again on {nextChangeLabel(current.setAt)}.
          </p>
          {secondary && <div className="line-actions">{secondary}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={splash ? 'line-editor line-editor-splash' : 'line-editor'}>
      {current && !splash && (
        <p className="line-meta">
          Last time: <span className="line-last">“{current.line}”</span>
        </p>
      )}
      <input
        className={splash ? 'line-input-splash' : 'filter-preset-input line-input'}
        type="text"
        value={draft}
        maxLength={SPLASH_LINE_MAX}
        placeholder={splash ? 'Write their line…' : 'Their line'}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void handleSave()
        }}
        aria-label="Their splash line"
        autoFocus={splash}
      />
      {/* On the splash this hangs below the words block, so nothing under
          the field can push the field itself off the tagline's line. */}
      <div className="line-below">
        <p className={`line-count${count >= SPLASH_LINE_MAX ? ' line-count-full' : ''}`}>
          {count}/{SPLASH_LINE_MAX}
        </p>
        {current && splash && (
          <p className="line-meta">
            Last time: <span className="line-last">“{current.line}”</span>
          </p>
        )}
        <p className="line-meta">Once set, it can be changed once a month.</p>
        {message && <p className="line-meta line-error">{message}</p>}
        <div className="line-actions">
          {secondary}
          <button
            type="button"
            className="filter-save-button"
            disabled={!changed || saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
