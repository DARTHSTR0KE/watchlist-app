import { useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { initialsOf } from '../utils/initials'
import type { WheelItem } from './titles'
import { buildBackdropUrl, buildPosterUrl, buildProfileUrl } from './posters'
import { useTopCast } from './useTopCast'

/**
 * A film, the way the wheel shows one when it lands: backdrop behind,
 * poster, title, year, runtime, genres, rating, synopsis, trailer and cast.
 * Shared by the wheel's result and every poster opened from a list; only
 * the actions underneath differ, and those are the caller's.
 */
interface FilmSheetProps {
  item: WheelItem
  reduceMotion: boolean
  onDismiss: () => void
  // Drawn over the header's corner: the wheel's reaction, or nothing.
  corner?: ReactNode
  // A line under the meta, such as "Loading the details…".
  status?: string | null
  // The action area: buttons for this context.
  children: ReactNode
}

const DISMISS_DRAG_THRESHOLD = 120
const SYNOPSIS_CLAMP_THRESHOLD = 200

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export function FilmSheet({ item, reduceMotion, onDismiss, corner, status, children }: FilmSheetProps) {
  const [expanded, setExpanded] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<number | null>(null)
  // The YouTube player is only loaded once someone actually asks for it —
  // an embed per spin result would be a lot of weight on a phone.
  const [trailerPlaying, setTrailerPlaying] = useState(false)
  // A profile_path can go stale on TMDB's side; a 404 should read as "no
  // portrait" rather than a broken-image glyph in a row of eight.
  const [failedPhotos, setFailedPhotos] = useState<ReadonlySet<string>>(new Set())
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

  const subline = [item.year > 0 ? String(item.year) : null, item.runtimeMinutes > 0 ? formatRuntime(item.runtimeMinutes) : null]
    .filter(Boolean)
    .join(' · ')

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
            {corner}
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
            {/* A film opened from a list may not have been fully filled in
                yet: whatever is missing is left out, never shown as zero. */}
            {subline && <p className="modal-subline">{subline}</p>}
            <div className="modal-genres">
              {item.genres.map((genre) => (
                <span className="genre-tag" key={genre}>
                  {genre}
                </span>
              ))}
            </div>
            {item.rating > 0 && <p className="modal-rating">★ {item.rating.toFixed(1)} / 10</p>}
          </div>

          {status && <p className="modal-status">{status}</p>}

          {item.synopsis && (
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
          )}

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

        <div className="modal-actions">{children}</div>
      </div>
    </div>
  )
}
