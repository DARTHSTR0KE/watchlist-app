import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { WheelItem } from './titles'
import { buildBackdropUrl, buildPosterUrl } from './posters'

interface ResultModalProps {
  item: WheelItem
  rerollsRemaining: number
  canReroll: boolean
  reduceMotion: boolean
  onWatch: () => void
  onSpinAgain: () => void
  onTakeOff: () => void
  onDismiss: () => void
}

const DISMISS_DRAG_THRESHOLD = 120
const SYNOPSIS_CLAMP_THRESHOLD = 200

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export function ResultModal({
  item,
  rerollsRemaining,
  canReroll,
  reduceMotion,
  onWatch,
  onSpinAgain,
  onTakeOff,
  onDismiss,
}: ResultModalProps) {
  const [expanded, setExpanded] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartRef = useRef<number | null>(null)

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
          <button type="button" className="action-button" onClick={onTakeOff}>
            Take it off the wheel
          </button>
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
