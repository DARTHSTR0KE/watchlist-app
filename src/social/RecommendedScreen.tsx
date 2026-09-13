import { useEffect, useRef, useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import { FilmPicker } from '../wheel/FilmPicker'
import type { PickedFilm } from '../wheel/FilmPicker'
import {
  loadRecommendationsForMe,
  loadRecommendationsSent,
  markRecommendationsSeen,
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
  // Lets the shell clear the badge once these have been looked at.
  onSeen: () => void
}

function RecommendationRow({
  item,
  children,
}: {
  item: Recommendation
  children?: React.ReactNode
}) {
  const posterUrl = buildPosterUrl(item.posterPath)
  return (
    <li className="rec-row">
      {posterUrl ? (
        <img className="rec-poster" src={posterUrl} alt="" aria-hidden="true" />
      ) : (
        <span className="rec-poster picker-poster-fallback" aria-hidden="true" />
      )}
      <div className="rec-body">
        <p className="rec-title">
          {item.title}
          <span className="picker-year">{item.year ? ` ${item.year}` : ''}</span>
        </p>
        {item.note ? (
          <p className="rec-note">“{item.note}”</p>
        ) : (
          <p className="rec-note rec-note-empty">No note.</p>
        )}
        {children}
      </div>
    </li>
  )
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
  const [sentOpen, setSentOpen] = useState(false)
  const [note, setNote] = useState('')
  // Step one picks the film; step two writes about it. Nothing about the
  // note is on screen until there is a film for it to be about.
  const [chosen, setChosen] = useState<PickedFilm | null>(null)
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Held in a ref so the load effect keys on the user alone; depending on
  // the callback would re-mark everything seen on every render.
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
      // Opening the screen is what counts as having seen them.
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
        entry.id === item.id
          ? { ...entry, status, respondedAt: new Date().toISOString() }
          : entry,
      ),
    )

  const revert = (item: Recommendation) =>
    setReceived((current) => current.map((entry) => (entry.id === item.id ? item : entry)))

  const handleAdd = async (item: Recommendation) => {
    setBusyId(item.id)
    setMessage(null)
    const { error } = await addExistingFilmToWatchlist(userId, item.filmId)
    // Already on the list still means the recommendation is dealt with, so
    // only a real failure leaves it waiting.
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

  const handleSend = async () => {
    if (!partnerId || !chosen) return
    setSending(true)
    setMessage(null)
    try {
      // Enriched here, at the point of committing — not when it was
      // merely tapped in a list of results.
      const filmId = chosen.source
        ? await ensureFilmStored(chosen.source.mediaType, chosen.source.tmdbId)
        : chosen.filmId
      await sendRecommendation(userId, partnerId, filmId, note)
      setMessage(`Sent "${chosen.title}".`)
      setChosen(null)
      setNote('')
      const outgoing = await loadRecommendationsSent(userId).catch(() => sent)
      setSent(outgoing)
      setSentOpen(true)
    } catch {
      setMessage(`Couldn't send "${chosen.title}".`)
    }
    setSending(false)
  }

  if (loading) return null

  if (!partnerId) {
    return (
      <div className="list-screen">
        <h2 className="list-screen-title">Recommendations</h2>
        <p className="preset-empty">
          No partner is linked to this account, so there is nobody to swap recommendations with.
        </p>
      </div>
    )
  }

  // Everything below reads the live name. Only an unreadable profile row
  // falls back, and to a pronoun rather than a name.
  const them = partnerName ?? 'them'
  const waiting = received.filter((item) => item.respondedAt === null)
  const answered = received.filter((item) => item.respondedAt !== null)

  return (
    <div className="list-screen">
      <h2 className="list-screen-title">{them}</h2>

      {/* One place for every message on this screen, rather than one
          buried between a set of tabs and a search box. */}
      {message && <p className="filter-hint rec-message">{message}</p>}

      <section className="rec-section">
        <h3 className="stat-section-title">From {them}</h3>
        {received.length === 0 ? (
          <p className="preset-empty">Nothing yet. Anything {them} sends will land here.</p>
        ) : (
          <ul className="rec-list">
            {waiting.map((item) => (
              <RecommendationRow item={item} key={item.id}>
                <div className="rec-actions">
                  <button
                    type="button"
                    className="wheel-row-action"
                    disabled={busyId === item.id}
                    onClick={() => void handleAdd(item)}
                  >
                    Add to my watchlist
                  </button>
                  <button
                    type="button"
                    className="wheel-row-action"
                    disabled={busyId === item.id}
                    onClick={() => void handlePass(item)}
                  >
                    Pass
                  </button>
                </div>
              </RecommendationRow>
            ))}
            {answered.map((item) => (
              <RecommendationRow item={item} key={item.id}>
                <p className="rec-outcome">
                  {item.status === 'passed' ? 'Passed' : 'On your watchlist'}
                </p>
              </RecommendationRow>
            ))}
          </ul>
        )}
      </section>

      {/* Collapsed by default: it is a reference for what is outstanding,
          not something to work through. */}
      <section className="rec-section">
        <button
          type="button"
          className="rec-disclosure"
          aria-expanded={sentOpen}
          onClick={() => setSentOpen((open) => !open)}
        >
          <span className="stat-section-title">Sent to {them}</span>
          <span className="rec-disclosure-count">
            {sent.length} waiting {sentOpen ? '−' : '+'}
          </span>
        </button>
        {sentOpen &&
          (sent.length === 0 ? (
            <p className="preset-empty">Nothing outstanding — {them} has answered everything.</p>
          ) : (
            <ul className="rec-list">
              {sent.map((item) => (
                <RecommendationRow item={item} key={item.id} />
              ))}
            </ul>
          ))}
      </section>

      <section className="rec-section">
        <h3 className="stat-section-title">Recommend a film to {them}</h3>

        {chosen === null ? (
          <FilmPicker
            userId={userId}
            partnerId={partnerId}
            partnerName={partnerName}
            // Recommending the same film twice is allowed, so nothing here
            // is ever "already there".
            existingIds={new Set<string>()}
            full={false}
            fullMessage={null}
            title="Find it"
            actionLabel="Choose"
            onSelect={setChosen}
          />
        ) : (
          <>
            <div className="rec-chosen">
              {buildPosterUrl(chosen.posterPath) ? (
                <img
                  className="rec-chosen-poster"
                  src={buildPosterUrl(chosen.posterPath)!}
                  alt=""
                  aria-hidden="true"
                />
              ) : (
                <span className="rec-chosen-poster picker-poster-fallback" aria-hidden="true" />
              )}
              <div className="rec-chosen-body">
                <p className="rec-title">
                  {chosen.title}
                  <span className="picker-year">{chosen.year ? ` ${chosen.year}` : ''}</span>
                </p>
                <button
                  type="button"
                  className="onboard-quiet rec-chosen-change"
                  onClick={() => setChosen(null)}
                >
                  Choose a different film
                </button>
              </div>
            </div>

            <input
              className="filter-preset-input rec-note-input"
              type="text"
              autoFocus
              placeholder={`What made you think of it for ${them}?`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <p className="stat-note">
              Optional, but a line of why lands better than a bare title.
            </p>
            <button
              type="button"
              className="action-button primary settings-wide"
              disabled={sending}
              onClick={() => void handleSend()}
            >
              {sending ? 'Sending…' : `Send to ${them}`}
            </button>
          </>
        )}
      </section>
    </div>
  )
}
