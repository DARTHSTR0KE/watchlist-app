import { useEffect, useRef, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { Empty, Loading, PosterThumb, Row, Rows, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
import { FilmPicker } from '../wheel/FilmPicker'
import type { PickedFilm } from '../wheel/FilmPicker'
import {
  loadRecommendationsForMe,
  loadRecommendationsSent,
  markRecommendationsSeen,
  partnerHasWatched,
  respondToRecommendation,
  sendRecommendation,
} from './recommendations'
import type { Recommendation } from './recommendations'
import { addExistingFilmToWatchlist, ensureFilmStored } from '../import/watchlistWrites'
import { NUDGE_MAX, NUDGE_SPOKEN_MAX, NudgeSendError, sendNudge } from './nudges'
import { Mascot } from '../brand/Mascot'
import type { Mascot as MascotName } from '../brand/mascots'

interface RecommendedScreenProps {
  userId: string
  partnerId: string | null
  // Read from profiles.display_name by the caller, never written down here.
  partnerName: string | null
  // Their animal, read the same way from profiles.mascot.
  partnerMascot: MascotName | null
  myMascot: MascotName | null
  onSeen: () => void
}

function yearSuffix(year: number | null): string {
  return year ? ` · ${year}` : ''
}

export function RecommendedScreen({
  userId,
  partnerId,
  partnerName,
  partnerMascot,
  myMascot,
  onSeen,
}: RecommendedScreenProps) {
  const [received, setReceived] = useState<Recommendation[]>([])
  const [sent, setSent] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [chosen, setChosen] = useState<PickedFilm | null>(null)
  const [composing, setComposing] = useState(false)
  const [nudge, setNudge] = useState('')
  const [nudgeState, setNudgeState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  // What actually went wrong, rather than the fact that something did.
  const [nudgeError, setNudgeError] = useState<string | null>(null)
  const [onSplash, setOnSplash] = useState(false)
  // Asked once, for the film just chosen. 'unknown' covers the lookup
  // failing, which must not be mistaken for "they haven't seen it".
  const [seenByThem, setSeenByThem] = useState<'unknown' | 'yes' | 'no'>('unknown')
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onSeenRef = useRef(onSeen)
  useEffect(() => {
    onSeenRef.current = onSeen
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadRecommendationsForMe(userId).catch(() => [] as Recommendation[]),
      loadRecommendationsSent(userId).catch(() => [] as Recommendation[]),
    ]).then(async ([mine, outgoing]) => {
      if (cancelled) return
      setReceived(mine)
      setSent(outgoing)
      setLoading(false)
      if (mine.some((item) => !item.seen)) {
        await markRecommendationsSeen(userId).catch(() => {})
        if (!cancelled) onSeenRef.current()
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const settle = (item: Recommendation, status: Recommendation['status']) =>
    setReceived((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, status, respondedAt: new Date().toISOString() } : entry,
      ),
    )

  const revert = (item: Recommendation) =>
    setReceived((current) => current.map((entry) => (entry.id === item.id ? item : entry)))

  const handleAdd = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    const { error } = await addExistingFilmToWatchlist(userId, item.filmId)
    if (error && error !== 'Already on your watchlist.') {
      setMessage(`Couldn't add "${item.title}".`)
      setBusyId(null)
      return
    }
    settle(item, 'queued')
    await respondToRecommendation(item.id, 'queued').catch(() => revert(item))
    setMessage(error ? `"${item.title}" was already on your watchlist.` : `Added "${item.title}".`)
    setBusyId(null)
  }

  const handlePass = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    settle(item, 'passed')
    await respondToRecommendation(item.id, 'passed').catch(() => revert(item))
    setBusyId(null)
  }

  // One call, for one film, at the moment it is picked — never while
  // building a list.
  const handleChoose = (film: PickedFilm) => {
    setChosen(film)
    setSeenByThem('unknown')
    void partnerHasWatched(film.filmId)
      .then((seen) => setSeenByThem(seen ? 'yes' : 'no'))
      .catch(() => setSeenByThem('unknown'))
  }

  const handleSend = async () => {
    if (!partnerId || !chosen) return
    setSending(true)
    setMessage(null)
    try {
      const filmId = chosen.source
        ? await ensureFilmStored(chosen.source.mediaType, chosen.source.tmdbId)
        : chosen.filmId
      await sendRecommendation(userId, partnerId, filmId, note)
      setMessage(`Sent "${chosen.title}".`)
      setChosen(null)
      setSeenByThem('unknown')
      setNote('')
      setComposing(false)
      setSent(await loadRecommendationsSent(userId).catch(() => sent))
    } catch {
      setMessage(`Couldn't send "${chosen.title}".`)
    }
    setSending(false)
  }

  if (loading) {
    return (
      <Screen>
        <ScreenHead title="Recommendations" />
        <Loading>Seeing what's arrived…</Loading>
      </Screen>
    )
  }

  if (!partnerId) {
    return (
      <Screen>
        <ScreenHead title="Recommendations" />
        <Empty>
          No partner is linked to this account, so there is nobody to swap recommendations with.
        </Empty>
      </Screen>
    )
  }

  const them = partnerName ?? 'them'
  const tooLongToSpeak = nudge.trim().length > NUDGE_SPOKEN_MAX
  const waiting = received.filter((item) => item.respondedAt === null)
  const answered = received.filter((item) => item.respondedAt !== null)
  const chosenPoster = chosen ? buildPosterUrl(chosen.posterPath) : null

  return (
    <Screen>
      <ScreenHead
        title={`From ${them}`}
        status={
          <>
            <Mascot who={partnerMascot} size={22} bowl className="mascot-inline" />{' '}
            {waiting.length} waiting
          </>
        }
      />

      {message && <Empty>{message}</Empty>}

      {received.length === 0 ? (
        <Empty art="raccoon">Nothing yet. Anything {them} sends lands here.</Empty>
      ) : (
        <Rows>
          {waiting.map((item) => (
            <Row
              key={item.id}
              art={<PosterThumb posterPath={item.posterPath} title={item.title} />}
              name={item.title}
              meta={
                <>
                  <Mascot who={partnerMascot} size={18} bowl className="mascot-inline" /> {them}
                  {yearSuffix(item.year)}
                </>
              }
              actions={
                <>
                  {/* On the row, so acting on one is a single tap from
                      the list rather than a trip into a detail view. */}
                  <button
                    type="button"
                    className="btn-row"
                    disabled={busyId === item.id}
                    onClick={() => void handleAdd(item)}
                  >
                    Add to my watchlist
                  </button>
                  <button
                    type="button"
                    className="btn-row"
                    disabled={busyId === item.id}
                    onClick={() => void handlePass(item)}
                  >
                    Pass
                  </button>
                </>
              }
            >
              {item.note ? (
                <p className="row-note">“{item.note}”</p>
              ) : (
                <p className="row-note row-note-empty">No note.</p>
              )}
            </Row>
          ))}

          {answered.map((item) => (
            <Row
              key={item.id}
              art={<PosterThumb posterPath={item.posterPath} title={item.title} />}
              name={item.title}
              meta={item.status === 'passed' ? 'Passed' : 'On your watchlist'}
            />
          ))}
        </Rows>
      )}

      <SectionLabel>
        <Mascot who={myMascot} size={20} bowl className="mascot-inline" /> Sent to {them}
      </SectionLabel>
      {sent.length === 0 ? (
        <Empty>Nothing outstanding — {them} has answered everything.</Empty>
      ) : (
        <Rows>
          {sent.map((item) => (
            <Row
              key={item.id}
              art={<PosterThumb posterPath={item.posterPath} title={item.title} />}
              name={item.title}
              meta={item.note ? `“${item.note}”` : `Waiting${yearSuffix(item.year)}`}
            />
          ))}
        </Rows>
      )}

      {composing ? (
        <>
          <SectionLabel>Recommend a film to {them}</SectionLabel>
          {chosen === null ? (
            <FilmPicker
              userId={userId}
              partnerId={partnerId}
              existingIds={new Set<string>()}
              full={false}
              fullMessage={null}
              title="Find it"
              actionLabel="Choose"
              onSelect={handleChoose}
            />
          ) : (
            <>
              <Rows>
                <Row
                  art={
                    chosenPoster ? (
                      <img className="row-poster" src={chosenPoster} alt="" aria-hidden="true" />
                    ) : (
                      <span className="row-poster row-poster-empty" aria-hidden="true" />
                    )
                  }
                  name={chosen.title}
                  meta={chosen.year ? String(chosen.year) : undefined}
                  actions={
                    <button
                      type="button"
                      className="btn-row"
                      onClick={() => {
                        setChosen(null)
                        setSeenByThem('unknown')
                      }}
                    >
                      Choose a different film
                    </button>
                  }
                />
              </Rows>
              {/* Before the note is written, not after — a rewatch is a
                  fine thing to recommend, but knowing changes what you
                  would say about it. */}
              {seenByThem === 'yes' && (
                <p className="notice">{them} has already seen this.</p>
              )}
              <input
                className="filter-preset-input rec-note-input"
                type="text"
                autoFocus
                placeholder={`What made you think of it for ${them}?`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <p className="screen-empty">
                Optional, but a line of why lands better than a bare title.
              </p>
              {/* The one amber button on this screen. */}
              <button
                type="button"
                className="btn-primary"
                disabled={sending}
                onClick={() => void handleSend()}
              >
                {sending ? 'Sending…' : `Send to ${them}`}
              </button>
            </>
          )}
          <button type="button" className="btn-field" onClick={() => setComposing(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setComposing(true)}>
          Recommend a film to {them}
        </button>
      )}

      {/* A message rather than a film. It waits until they next open the
          app — nothing is pushed, and nothing asks for permission. */}
      <SectionLabel tone="sage">
        {/* The label names them, so the animal beside it is theirs — mine
            there reads as though they were the fish. */}
        <Mascot who={partnerMascot} size={20} bowl className="mascot-inline" /> Nudge {them}
      </SectionLabel>
      <input
        className="filter-preset-input rec-note-input"
        type="text"
        maxLength={NUDGE_MAX}
        placeholder={`Say something to ${them}`}
        value={nudge}
        onChange={(event) => {
          setNudge(event.target.value)
          setNudgeState('idle')
          setNudgeError(null)
        }}
      />

      {/* Only for something short enough to be read over an animal's head
          in the seconds the splash is up. */}
      <label className="filter-toggle">
        <input
          type="checkbox"
          checked={onSplash && !tooLongToSpeak}
          disabled={tooLongToSpeak}
          onChange={(event) => setOnSplash(event.target.checked)}
        />
        Say it on their splash
      </label>
      {tooLongToSpeak && (
        <Empty>
          Too long to speak — {NUDGE_SPOKEN_MAX} characters at most, and that's{' '}
          {nudge.trim().length}. It will still arrive as a banner.
        </Empty>
      )}
      <button
        type="button"
        className="btn-field"
        disabled={!partnerId || nudge.trim().length === 0 || nudgeState === 'sending'}
        onClick={() => {
          if (!partnerId) return
          setNudgeState('sending')
          setNudgeError(null)
          void sendNudge(userId, partnerId, nudge, onSplash && !tooLongToSpeak)
            .then(() => {
              setNudge('')
              setOnSplash(false)
              setNudgeState('sent')
            })
            .catch((error: unknown) => {
              // Reported, not swallowed: the code is what says whether the
              // table is missing, a policy refused it, or a key dangled.
              setNudgeError(
                error instanceof NudgeSendError
                  ? error.report
                  : error instanceof Error
                    ? error.message
                    : 'Unknown error.',
              )
              setNudgeState('failed')
            })
        }}
      >
        {nudgeState === 'sending' ? 'Sending…' : 'Send nudge'}
      </button>
      {nudgeState === 'sent' && (
        <Empty>Waiting for them. They'll see it next time they open the app.</Empty>
      )}
      {nudgeState === 'failed' && (
        <Empty>That didn't send. {nudgeError ?? 'No reason was given.'}</Empty>
      )}
      {/* One at a time, in each direction. */}
      {nudgeState === 'idle' && nudge.trim().length > 0 && (
        <Empty>Sending this replaces any nudge of yours they haven't seen yet.</Empty>
      )}
    </Screen>
  )
}
