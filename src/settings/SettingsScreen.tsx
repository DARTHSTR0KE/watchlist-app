import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ensureAudioContext, playTick, useMuted } from '../wheel/tickSound'
import { NoRowsAffected, saveDisplayName } from '../onboarding/onboardingState'
import { BirthdayVideo } from '../birthday/BirthdayVideo'
import { Empty, Row, Rows, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
import { ClearAllData } from './ClearAllData'
import { FilmRefresh } from './FilmRefresh'
import { LineForThem } from './LineForThem'
import { QuietFailure } from './QuietFailure'
import { loadWatchlistSummary } from '../import/watchlistWrites'
import type { WatchlistSummary } from '../import/watchlistWrites'

interface SettingsScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  displayName: string | null
  // 'unreadable' is a real condition worth naming: it means the profile
  // row is missing or unreadable, which an empty field would disguise as
  // a name nobody has chosen yet.
  profileStatus: 'loading' | 'ready' | 'unreadable'
  // Lifts the new name to the shell so every screen showing it updates at
  // once, rather than each waiting for its own reload.
  onDisplayNameChange: (name: string) => void
  onGoToImport: () => void
  // Everything the shell is holding describes data that no longer exists.
  onDataCleared: () => void
}

export function SettingsScreen({
  userId,
  partnerId,
  partnerName,
  displayName,
  profileStatus,
  onDisplayNameChange,
  onGoToImport,
  onDataCleared,
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
  const [summary, setSummary] = useState<WatchlistSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadWatchlistSummary(userId)
      .catch(() => null)
      .then((rows) => {
        if (!cancelled) setSummary(rows)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

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
    <Screen>
      <ScreenHead title="Settings" status={displayName ?? undefined} />

      <section>
        <SectionLabel>Your name</SectionLabel>
        {profileStatus === 'unreadable' ? (
          <Empty>
            Your profile couldn't be read, so there's no name to show or change. The row may be
            missing, or a policy may be blocking it.
          </Empty>
        ) : (
          <>
            <p className="screen-empty">This is what the other person sees you as, everywhere.</p>
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

      {partnerId && (
        <LineForThem userId={userId} partnerId={partnerId} partnerName={partnerName} />
      )}

      <section>
        <SectionLabel>Sound</SectionLabel>
        <label className="filter-toggle">
          <input type="checkbox" checked={!muted} onChange={handleToggleMute} />
          Tick as the wheel turns
        </label>
      </section>

      <section>
        <SectionLabel>Your films</SectionLabel>
        {/* What is already there, so importing again is a decision rather
            than a guess. */}
        <Rows>
          <Row
            name={
              summary === null
                ? 'Counting…'
                : `${summary.count} film${summary.count === 1 ? '' : 's'} on your watchlist`
            }
            meta={
              summary === null
                ? undefined
                : summary.lastImportedAt
                  ? `Last imported ${new Date(summary.lastImportedAt).toLocaleDateString()}`
                  : 'Never imported'
            }
          />
        </Rows>
        {/* The one amber button on this screen. */}
        <button type="button" className="btn-primary" onClick={onGoToImport}>
          Import a watchlist
        </button>
      </section>

      <FilmRefresh />

      <QuietFailure />

      <section>
        <SectionLabel>Help</SectionLabel>
        <button type="button" className="btn-field" onClick={() => setShowIntro(true)}>
          haaapppyyyy birthdayyyy
        </button>
      </section>

      <section>
        {/* Bordered, not competing with a primary action. */}
        <button type="button" className="btn-field btn-danger" onClick={signOut}>
          Sign out
        </button>
      </section>

      {/* Last on the screen, and the only thing here that can't be undone. */}
      <ClearAllData
        userId={userId}
        partnerId={partnerId}
        partnerName={partnerName}
        onCleared={onDataCleared}
      />

      {/* Replaying from here never records the day as spent, so it can't
          stop the real one firing. */}
      {showIntro && (
        <BirthdayVideo
          recordPlayed={false}
          onPlayed={() => {}}
          onClose={() => setShowIntro(false)}
        />
      )}
    </Screen>
  )
}
