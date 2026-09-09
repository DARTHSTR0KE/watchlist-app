import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ensureAudioContext, playTick, useMuted } from '../wheel/tickSound'
import { NoRowsAffected, saveDisplayName } from '../onboarding/onboardingState'
import { IntroVideo } from './IntroVideo'

interface SettingsScreenProps {
  userId: string
  displayName: string | null
  // 'unreadable' is a real condition worth naming: it means the profile
  // row is missing or unreadable, which an empty field would disguise as
  // a name nobody has chosen yet.
  profileStatus: 'loading' | 'ready' | 'unreadable'
  // Lifts the new name to the shell so every screen showing it updates at
  // once, rather than each waiting for its own reload.
  onDisplayNameChange: (name: string) => void
  onReplayWalkthrough: () => void
  onGoToImport: () => void
}

export function SettingsScreen({
  userId,
  displayName,
  profileStatus,
  onDisplayNameChange,
  onReplayWalkthrough,
  onGoToImport,
}: SettingsScreenProps) {
  const { signOut } = useAuth()
  const [muted, toggleMuted] = useMuted()

  // The profile arrives after this mounts, so the field has to follow it.
  // useState alone would capture the empty value it mounted with and keep
  // showing a blank box after the name loaded.
  const [draft, setDraft] = useState(displayName ?? '')
  const [draftFor, setDraftFor] = useState(displayName)
  if (draftFor !== displayName) {
    setDraftFor(displayName)
    setDraft(displayName ?? '')
  }
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(false)

  // Unmuting plays one tick straight away, so the sound can be confirmed
  // here rather than by going back and spinning. Awaits the context so it
  // isn't lost to a pending resume on the first interaction of a session.
  const handleToggleMute = () => {
    const wasMuted = muted
    toggleMuted()
    if (wasMuted) void ensureAudioContext().then(playTick)
  }

  const trimmed = draft.trim()
  const changed = trimmed.length > 0 && trimmed !== (displayName ?? '')

  const handleSave = async () => {
    if (!changed) return
    setSaving(true)
    setMessage(null)
    try {
      await saveDisplayName(userId, trimmed)
      onDisplayNameChange(trimmed)
      setMessage('Saved.')
    } catch (error) {
      // A write that matched no row comes back here rather than looking
      // like a success, which is what made this seem to work before.
      setMessage(
        error instanceof NoRowsAffected
          ? "That didn't save — your profile row couldn't be written to."
          : "Couldn't save that. Try again.",
      )
      setDraft(displayName ?? '')
    }
    setSaving(false)
  }

  return (
    <div className="list-screen">
      <h2 className="list-screen-title">Settings</h2>

      <section className="rec-section">
        <h3 className="stat-section-title">Your name</h3>
        {profileStatus === 'unreadable' ? (
          <p className="preset-empty">
            Your profile couldn't be read, so there's no name to show or change. The row may be
            missing, or a policy may be blocking it.
          </p>
        ) : (
          <>
            <p className="stat-note">This is what the other person sees you as, everywhere.</p>
            <div className="filter-save-row">
              <input
                className="filter-preset-input"
                type="text"
                value={draft}
                disabled={profileStatus === 'loading'}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Your name"
              />
              <button
                type="button"
                className="filter-save-button"
                disabled={!changed || saving}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Update'}
              </button>
            </div>
            {message && <p className="filter-hint">{message}</p>}
          </>
        )}
      </section>

      <section className="rec-section">
        <h3 className="stat-section-title">Sound</h3>
        <label className="filter-toggle">
          <input type="checkbox" checked={!muted} onChange={handleToggleMute} />
          Tick as the wheel turns
        </label>
      </section>

      <section className="rec-section">
        <h3 className="stat-section-title">Your films</h3>
        <p className="stat-note">
          Bring a Letterboxd export in, or add to what's already here.
        </p>
        <button type="button" className="action-button settings-wide" onClick={onGoToImport}>
          Import a watchlist
        </button>
      </section>

      <section className="rec-section">
        <h3 className="stat-section-title">Help</h3>
        <div className="settings-buttons">
          <button type="button" className="action-button" onClick={() => setShowIntro(true)}>
            Play intro
          </button>
          <button type="button" className="action-button" onClick={onReplayWalkthrough}>
            Replay walkthrough
          </button>
        </div>
      </section>

      <section className="rec-section">
        <button type="button" className="action-button settings-signout" onClick={signOut}>
          Sign out
        </button>
      </section>

      {showIntro && <IntroVideo onClose={() => setShowIntro(false)} />}
    </div>
  )
}
