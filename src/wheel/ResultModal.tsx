import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { WheelItem } from './titles'
import { buildBackdropUrl, buildPosterUrl, buildProfileUrl } from './posters'
import { useTopCast } from './useTopCast'

interface ResultModalProps {
  item: WheelItem
  rerollsRemaining: number
  canReroll: boolean
  canRemoveFromWheel: boolean
  reduceMotion: boolean
  // Absent when no partner is linked, which makes recommending impossible
  // rather than merely unused.
  partnerName: string | null
  onRecommend: (note: string) => Promise<void>
  // Empty outside the two shared sources. One each per spin session, so a
  // used one stays visible and disabled rather than disappearing. The label
  // is built by the caller, which is what knows whether the subject is
  // "you" or a name — the verb has to agree with it.
  vetoes: { key: string; label: string; used: boolean }[]
  onVeto: (key: string) => void
  onWatch: () => void
  onSpinAgain: () => void
  onTakeOff: () => void
  onReshuffle: () => void
  onDismiss: () => void
}

const DISMISS_DRAG_THRESHOLD = 120
const SYNOPSIS_CLAMP_THRESHOLD = 200

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

// Initials stand in when TMDB has no portrait for someone.
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

// 6pm–4am local -> "Not tonight", 4am–6pm -> "Not today".
function getTakeOffLabel(): string {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 4 ? 'Not tonight' : 'Not today'
}

export function ResultModal({
  item,
  rerollsRemaining,
  canReroll,
  canRemoveFromWheel,
  reduceMotion,
  partnerName,
  onRecommend,
  vetoes,
  onVeto,
  onWatch,
  onSpinAgain,
  onTakeOff,
  onReshuffle,
  onDismiss,
}: ResultModalProps) {
  const [expanded, setExpanded] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<number | null>(null)
  // Computed once per mount — the modal re-mounts fresh each time it opens
  // (result goes null then non-null again), so this re-evaluates every open
  // rather than staying fixed from whenever the app first started.
  const [takeOffLabel] = useState(getTakeOffLabel)
  // The YouTube player is only loaded once someone actually asks for it —
  // an embed per spin result would be a lot of weight on a phone.
  const [trailerPlaying, setTrailerPlaying] = useState(false)
  // A profile_path can go stale on TMDB's side; a 404 should read as "no
  // portrait" rather than a broken-image glyph in a row of eight.
  const [failedPhotos, setFailedPhotos] = useState<ReadonlySet<string>>(new Set())
  const [recommending, setRecommending] = useState(false)
  const [note, setNote] = useState('')
  const [recommendState, setRecommendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle',
  )
  const cast = useTopCast(item.id, item.topCast)

  const backdropUrl = buildBackdropUrl(item.backdropPath)
  const posterUrl = buildPosterUrl(item.posterPath)
  const needsClampToggle = item.synopsis.length > SYNOPSIS_CLAMP_THRESHOLD

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = event.clientY
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current === null) return
    const delta = event.clientY - dragStartRef.current
    if (delta > 0) setDragY(delta)
  }

  const handlePointerUp = () => {
    if (dragStartRef.current === null) return
    dragStartRef.current = null
    setDragging(false)
    if (dragY > DISMISS_DRAG_THRESHOLD) {
      onDismiss()
    }
    setDragY(0)
  }

  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div
        className="modal-sheet"
        onClick={(event) => event.stopPropagation()}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging || reduceMotion ? 'none' : 'transform 300ms ease-out',
        }}
      >
        <div
          className="modal-drag-region"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="modal-grabber" />
          <div className="modal-header">
            {backdropUrl && <img className="modal-backdrop" src={backdropUrl} alt="" aria-hidden="true" />}
            <div className="modal-header-fade" />
            {posterUrl ? (
              <img className="modal-poster" src={posterUrl} alt={`${item.title} poster`} />
            ) : (
              <div className="modal-poster modal-poster-fallback" aria-hidden="true" />
            )}
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-meta">
            <h2 className="modal-title">{item.title}</h2>
            <p className="modal-subline">
              {item.year} · {formatRuntime(item.runtimeMinutes)}
            </p>
            <div className="modal-genres">
              {item.genres.map((genre) => (
                <span className="genre-tag" key={genre}>
                  {genre}
                </span>
              ))}
            </div>
            <p className="modal-rating">★ {item.rating.toFixed(1)} / 10</p>
          </div>

          <div className="modal-synopsis">
            <p className={needsClampToggle && !expanded ? 'synopsis-clamped' : ''}>{item.synopsis}</p>
            {needsClampToggle && (
              <button
                type="button"
                className="synopsis-toggle"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? 'less' : 'more'}
              </button>
            )}
          </div>

          {item.trailerKey && (
            <div className="modal-trailer">
              {trailerPlaying ? (
                <iframe
                  className="modal-trailer-frame"
                  src={`https://www.youtube-nocookie.com/embed/${item.trailerKey}?autoplay=1&rel=0`}
                  title={`${item.title} trailer`}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  className="modal-trailer-facade"
                  onClick={() => setTrailerPlaying(true)}
                  aria-label={`Play the ${item.title} trailer`}
                >
                  {backdropUrl && <img src={backdropUrl} alt="" aria-hidden="true" />}
                  <span className="modal-trailer-play" aria-hidden="true" />
                  <span className="modal-trailer-label">Trailer</span>
                </button>
              )}
            </div>
          )}

          {cast !== null && cast.length > 0 && (
            <div className="modal-cast">
              <h3 className="modal-section-title">Cast</h3>
              <ul className="cast-row">
                {cast.map((member, index) => {
                  const key = `${member.name}-${index}`
                  const profileUrl = failedPhotos.has(key)
                    ? null
                    : buildProfileUrl(member.profile_path)
                  return (
                    <li className="cast-member" key={key}>
                      {profileUrl ? (
                        <img
                          className="cast-photo"
                          src={profileUrl}
                          alt=""
                          aria-hidden="true"
                          onError={() =>
                            setFailedPhotos((current) => new Set(current).add(key))
                          }
                        />
                      ) : (
                        <span className="cast-photo cast-photo-fallback" aria-hidden="true">
                          {initialsOf(member.name)}
                        </span>
                      )}
                      <span className="cast-name">{member.name}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="action-button primary" onClick={onWatch}>
            Watch this
          </button>
          <button
            type="button"
            className="action-button"
            onClick={onSpinAgain}
            disabled={!canReroll}
          >
            Spin again
          </button>
          {canRemoveFromWheel ? (
            <button type="button" className="action-button" onClick={onTakeOff}>
              {takeOffLabel}
            </button>
          ) : (
            <button type="button" className="action-button" onClick={onReshuffle}>
              Reshuffle
            </button>
          )}
          {vetoes.length > 0 && (
            <div className="veto-row">
              {vetoes.map((veto) => (
                <button
                  key={veto.key}
                  type="button"
                  className="action-button veto-button"
                  disabled={veto.used}
                  onClick={() => onVeto(veto.key)}
                >
                  {veto.label}
                </button>
              ))}
            </div>
          )}

          {partnerName !== null &&
            (recommendState === 'sent' ? (
              <p className="reroll-status">Sent to {partnerName}.</p>
            ) : recommending ? (
              <div className="recommend-form">
                <input
                  className="filter-preset-input"
                  type="text"
                  placeholder={`Why ${partnerName} should watch it (optional)`}
                  value={note}
                  autoFocus
                  onChange={(event) => setNote(event.target.value)}
                />
                <button
                  type="button"
                  className="filter-save-button"
                  disabled={recommendState === 'sending'}
                  onClick={() => {
                    setRecommendState('sending')
                    void onRecommend(note)
                      .then(() => setRecommendState('sent'))
                      .catch(() => setRecommendState('failed'))
                  }}
                >
                  {recommendState === 'sending' ? 'Sending…' : 'Send'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="action-button"
                onClick={() => setRecommending(true)}
              >
                Recommend to {partnerName}
              </button>
            ))}
          {recommendState === 'failed' && (
            <p className="reroll-status">That didn't send. Try again.</p>
          )}

          <p className="reroll-status">
            {canReroll
              ? `${rerollsRemaining} reroll${rerollsRemaining === 1 ? '' : 's'} remaining`
              : "That's the one."}
          </p>
        </div>
      </div>
    </div>
  )
}
