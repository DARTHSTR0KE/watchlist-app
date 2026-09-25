import { useEffect, useRef, useState } from 'react'
import { IdleScene } from '../brand/PairScene'
import { agree, subjectName } from '../utils/names'
import { buildPosterUrl } from '../wheel/posters'
import { Empty, Loading, PosterThumb, Row, Rows, Screen, SectionLabel } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { Ground } from '../ui/Ground'
import { TINT, usePosterColors } from '../ui/posterColor'
import { ScreenCharacter } from '../brand/Ambient'
import { loadWatchedFilmIds } from '../wheel/loadWheelItems'
import { forMeCounts, plural } from './ticketFacts'
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
  // For the ticket: of what they sent this year, how much I have watched.
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [chosen, setChosen] = useState<PickedFilm | null>(null)
  const [composing, setComposing] = useState(false)
  const [nudge, setNudge] = useState('')
  const [nudgeState, setNudgeState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  // What actually went wrong, rather than the fact that something did.
  const [nudgeError, setNudgeError] = useState<string | null>(null)
  // Asked once, for the film just chosen. 'unknown' covers the lookup
  // failing, which must not be mistaken for "they haven't seen it".
  const [seenByThem, setSeenByThem] = useState<'unknown' | 'yes' | 'no'>('unknown')
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const newestColor = usePosterColors(loading ? [] : [received[0]?.posterPath])
  const onSeenRef = useRef(onSeen)
  useEffect(() => {
    onSeenRef.current = onSeen
  })

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadRecommendationsForMe(userId).catch(() => [] as Recommendation[]),
      loadRecommendationsSent(userId).catch(() => [] as Recommendation[]),
      loadWatchedFilmIds(userId).catch(() => new Set<string>()),
    ]).then(async ([mine, outgoing, watched]) => {
      if (cancelled) return
      setReceived(mine)
      setWatchedIds(watched)
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
    await respondToRecommendation(item.id, 'queued', item.filmId).catch(() => revert(item))
    setMessage(error ? `"${item.title}" was already on your watchlist.` : `Added "${item.title}".`)
    setBusyId(null)
  }

  const handlePass = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    settle(item, 'passed')
    await respondToRecommendation(item.id, 'passed', item.filmId).catch(() => revert(item))
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

  const heading = `FROM ${(partnerName ?? 'them').toUpperCase()}`
  // The newest thing they sent colours the screen; nothing sent, amber.
  const ground = (
    <Ground tints={newestColor && newestColor.length > 0 ? newestColor : [TINT.amber]} />
  )

  if (loading) {
    return (
      <Screen ground={ground}>
        <Ticket heading={heading} figure="…" line="Seeing what's arrived" />
        <Loading art="goldfish">Seeing what's arrived…</Loading>
      </Screen>
    )
  }

  if (!partnerId) {
    return (
      <Screen ground={ground}>
        <Ticket heading="FOR ME" figure="—" line="No partner is linked to this account" />
        <Empty>
          No partner is linked to this account, so there is nobody to swap recommendations with.
        </Empty>
      </Screen>
    )
  }

  const them = partnerName ?? 'them'
  const nudgeLength = nudge.trim().length
  const tooLongToSpeak = nudgeLength > NUDGE_SPOKEN_MAX
  const nudgeSendable = Boolean(partnerId) && nudgeLength > 0 && nudgeState !== 'sending'

  const sendNudgeNow = () => {
    if (!partnerId) return
    setNudgeState('sending')
    setNudgeError(null)
    void sendNudge(userId, partnerId, nudge)
      .then(() => {
        setNudge('')
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
  }
  const waiting = received.filter((item) => item.respondedAt === null)
  const answered = received.filter((item) => item.respondedAt !== null)
  const chosenPoster = chosen ? buildPosterUrl(chosen.posterPath) : null
  const year = new Date().getFullYear()
  const { sentThisYear, watchedOfThem } = forMeCounts(received, watchedIds, year)

  return (
    <Screen
      ground={ground}
      character={
        <IdleScene
          // Choosing, writing or sending something is being mid-task.
          busy={
            sending || busyId !== null || composing || chosen !== null || nudgeState === 'sending'
          }
          fallback={<ScreenCharacter kind="raccoon" />}
        />
      }
    >
      <Ticket
        heading={heading}
        figure={`${waiting.length} waiting`}
        line={`${subjectName(partnerName, true)} ${agree(partnerName, 'has', 'have')} sent ${plural(sentThisYear, 'film')} this year`}
        perforation={
          sentThisYear > 0 ? `YOU HAVE WATCHED ${watchedOfThem} OF THEM` : undefined
        }
      />

      {message && <Empty>{message}</Empty>}

      {received.length === 0 ? (
        <Empty art="raccoon">Nothing yet. Anything {subjectName(partnerName)}{' '}
          {agree(partnerName, 'sends', 'send')} lands here.</Empty>
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
        <Empty>Nothing outstanding — {subjectName(partnerName)}{' '}
          {agree(partnerName, 'has', 'have')} answered everything.</Empty>
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
                <p className="notice">
                  {subjectName(partnerName, true)} {agree(partnerName, 'has', 'have')} already
                  seen this.
                </p>
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
      <div className="nudge-compose">
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

        {/* Counted against the spoken limit rather than the field's, so
            the reason the first button greys out is on screen before it
            happens rather than after. */}
        <p className={`nudge-count${tooLongToSpeak ? ' nudge-count-over' : ''}`}>
          {nudgeLength} / {NUDGE_SPOKEN_MAX}
        </p>

        {/* The only way to send one. The banner is still how it arrives
            when the splash doesn't get the chance — that is delivery, not
            a choice made here. */}
        <button
          type="button"
          className="btn-field"
          disabled={!nudgeSendable || tooLongToSpeak}
          onClick={sendNudgeNow}
        >
          {nudgeState === 'sending' ? 'Sending…' : 'Say it on their splash'}
        </button>
      </div>
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
