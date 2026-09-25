import { useEffect, useState } from 'react'
import { IdleScene } from '../brand/PairScene'
import { useAuth } from '../auth/AuthProvider'
import { ensureAudioContext, playTick, useMuted } from '../wheel/tickSound'
import { NoRowsAffected, saveDisplayName } from '../onboarding/onboardingState'
import { BirthdayVideo } from '../birthday/BirthdayVideo'
import { Empty, Screen, SectionLabel } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { Ground } from '../ui/Ground'
import { TINT, usePosterColors } from '../ui/posterColor'
import { ScreenCharacter } from '../brand/Ambient'
import { reportQuietly } from '../lib/dbError'
import { countMySpins, loadLastWatchedPoster, plural } from '../social/ticketFacts'
import { ClearAllData } from './ClearAllData'
import { FilmRefresh } from './FilmRefresh'
import { LineForThem } from './LineForThem'
import { Reunion } from './Reunion'
import { ForTheirWrapped } from '../gifts/ForTheirWrapped'
import { giftWindow } from '../gifts/giftWindow'
import { QuietFailure } from './QuietFailure'
import { SceneCheck } from './SceneCheck'
import type { Mascot } from '../brand/mascots'
import { loadWatchlistSummary } from '../import/watchlistWrites'
import type { WatchlistSummary } from '../import/watchlistWrites'

interface SettingsScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  displayName: string | null
  // Decides who sets the reunion date: the goldfish, and only the goldfish.
  myMascot: Mascot | null
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
  myMascot,
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
  const [spins, setSpins] = useState<number | null>(null)
  // Whether the counts have come back either way. A failed count stays
  // null, and waiting on null alone kept the screen busy for good.
  const [spinsSettled, setSpinsSettled] = useState(false)
  const [summarySettled, setSummarySettled] = useState(false)
  const [lastPoster, setLastPoster] = useState<string | null>(null)
  const lastColor = usePosterColors([lastPoster])

  useEffect(() => {
    let cancelled = false
    void countMySpins(userId)
      .then((count) => {
        if (!cancelled) setSpins(count)
      })
      .catch((error: unknown) => reportQuietly('Counting spins', error))
      .finally(() => {
        if (!cancelled) setSpinsSettled(true)
      })
    void loadLastWatchedPoster(userId)
      .then((poster) => {
        if (!cancelled) setLastPoster(poster)
      })
      .catch((error: unknown) => reportQuietly('Finding the last film watched', error))
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    void loadWatchlistSummary(userId)
      .catch(() => null)
      .then((rows) => {
        if (cancelled) return
        setSummary(rows)
        setSummarySettled(true)
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
    <Screen
      ground={<Ground tints={lastColor && lastColor.length > 0 ? lastColor : [TINT.slate]} />}
      character={
        <IdleScene
          busy={saving || !summarySettled || !spinsSettled}
          fallback={<ScreenCharacter kind="raccoon-asleep" />}
        />
      }
    >
      <Ticket
        heading="YOUR FILMS"
        figure={summary === null ? '…' : `${summary.count} on the list`}
        line={
          summary === null
            ? 'Counting'
            : summary.lastImportedAt
              ? `Last imported ${new Date(summary.lastImportedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : 'Never imported'
        }
        perforation={spins === null ? undefined : `${plural(spins, 'spin').toUpperCase()} SO FAR`}
      />

      <section>
        <SectionLabel>Your name</SectionLabel>
        {profileStatus === 'unreadable' ? (
          <Empty>
            Your profile couldn't be read, so there's no name to show or change. The row may be
            missing, or a policy may be blocking it.
          </Empty>
        ) : (
          <>
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

      {/* Mine alone to set. ac sees no date anywhere, only the warming. */}
      {partnerId && myMascot === 'goldfish' && <Reunion />}

      {/* Only from 1 to 14 December; the rest of the year it isn't here. */}
      {partnerId && giftWindow(new Date()) === 'open' && (
        <ForTheirWrapped userId={userId} partnerId={partnerId} partnerName={partnerName} />
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
        {/* The one amber button on this screen. */}
        <button type="button" className="btn-primary" onClick={onGoToImport}>
          Import a watchlist
        </button>
      </section>

      <FilmRefresh />

      <QuietFailure />

      {/* TEMPORARY: for confirming the idle scenes. Comes out once all ten
          have been seen. */}
      <SceneCheck />

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
