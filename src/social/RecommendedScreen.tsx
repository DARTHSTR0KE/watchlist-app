import { useEffect, useRef, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { Empty, PosterThumb, Row, Rows, Screen, ScreenHead, SectionLabel } from '../ui/Screen'
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

interface RecommendedScreenProps {
  userId: string
  partnerId: string | null
  // Read from profiles.display_name by the caller, never written down here.
  partnerName: string | null
  onSeen: () => void
}

function yearSuffix(year: number | null): string {
  return year ? ` · ${year}` : ''
}

export function RecommendedScreen({
  userId,
  partnerId,
  partnerName,
  onSeen,
}: RecommendedScreenProps) {
  const [received, setReceived] = useState<Recommendation[]>([])
  const [sent, setSent] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [chosen, setChosen] = useState<PickedFilm | null>(null)
  const [composing, setComposing] = useState(false)
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

  if (loading) return null

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
  const waiting = received.filter((item) => item.respondedAt === null)
  const answered = received.filter((item) => item.respondedAt !== null)
  const chosenPoster = chosen ? buildPosterUrl(chosen.posterPath) : null

  return (
    <Screen>
      <ScreenHead title={`From ${them}`} status={`${waiting.length} waiting`} />

      {message && <Empty>{message}</Empty>}

      {received.length === 0 ? (
        <Empty>Nothing yet. Anything {them} sends lands here.</Empty>
      ) : (
        <Rows>
          {waiting.map((item) => (
            <Row
              key={item.id}
              art={<PosterThumb posterPath={item.posterPath} title={item.title} />}
              name={item.title}
              meta={`${them}${yearSuffix(item.year)}`}
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

      <SectionLabel>Sent to {them}</SectionLabel>
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
    </Screen>
  )
}
