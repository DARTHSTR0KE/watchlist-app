import { useState } from 'react'
import type { FormEvent } from 'react'
import { buildPosterUrl } from './posters'
import { WHEEL_PREVIEW_POSTERS } from './customWheels'
import type { CustomWheel } from './customWheels'

interface CustomWheelsListProps {
  wheels: CustomWheel[]
  // Whose wheels the shared ones are, read from profiles by the caller.
  partnerName: string | null
  onCreate: (name: string) => void
  onSpin: (wheel: CustomWheel) => void
  onEdit: (wheel: CustomWheel) => void
  onDelete: (wheel: CustomWheel) => void
  onToggleShared: (wheel: CustomWheel) => void
}

// Three posters, overlapping, so a wheel is recognisable from its films
// rather than only from whatever it was named at the time.
function PosterStack({ posterPaths }: { posterPaths: string[] }) {
  const slots = posterPaths.slice(0, WHEEL_PREVIEW_POSTERS)
  if (slots.length === 0) {
    return <span className="wheel-stack wheel-stack-empty" aria-hidden="true" />
  }
  return (
    <span className="wheel-stack" aria-hidden="true">
      {slots.map((path, index) => (
        <img
          key={path}
          className="wheel-stack-poster"
          style={{ left: `${index * 14}px`, zIndex: slots.length - index }}
          src={buildPosterUrl(path) ?? undefined}
          alt=""
        />
      ))}
    </span>
  )
}

function WheelRow({
  wheel,
  partnerName,
  onSpin,
  onEdit,
  onDelete,
  onToggleShared,
}: {
  wheel: CustomWheel
  partnerName: string | null
  onSpin: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleShared: () => void
}) {
  return (
    <li className="wheel-pick-row">
      {/* The row itself loads the wheel; the controls below are for
          managing it. */}
      <button type="button" className="wheel-pick-main" onClick={onSpin}>
        <PosterStack posterPaths={wheel.posterPaths} />
        <span className="wheel-pick-text">
          <span className="wheel-pick-name">{wheel.name}</span>
          <span className="wheel-pick-meta">
            {wheel.filmCount} film{wheel.filmCount === 1 ? '' : 's'}
            {!wheel.isMine && ` · from ${partnerName ?? 'them'}`}
          </span>
        </span>
        {!wheel.isMine && <span className="wheel-pick-badge">Shared</span>}
      </button>

      {wheel.isMine && (
        <div className="wheel-pick-actions">
          <button type="button" className="wheel-row-action" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className={`wheel-row-action${wheel.shared ? ' wheel-row-action-on' : ''}`}
            aria-pressed={wheel.shared}
            onClick={onToggleShared}
          >
            {wheel.shared ? 'Shared' : 'Share'}
          </button>
          <button type="button" className="preset-delete" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Rendered where the wheel would be, not over it. A list about wheels on
 * top of a half-visible wheel was two things at once; this is one screen
 * doing one thing, with the header and source toggle still in place.
 */
export function CustomWheelsList({
  wheels,
  partnerName,
  onCreate,
  onSpin,
  onEdit,
  onDelete,
  onToggleShared,
}: CustomWheelsListProps) {
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState('')

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (name.length === 0) return
    onCreate(name)
    setNewName('')
    setNaming(false)
  }

  return (
    <div className="wheel-pick">
      <div className="wheel-pick-head">
        <h2 className="wheel-pick-title">Pick a wheel</h2>
        <span className="filter-sheet-count">
          {wheels.length} wheel{wheels.length === 1 ? '' : 's'}
        </span>
      </div>

      {wheels.length === 0 ? (
        <p className="preset-empty">
          No wheels yet. Make one, then fill it from a search, your lists, or an actor's films.
        </p>
      ) : (
        <ul className="wheel-pick-list">
          {wheels.map((wheel) => (
            <WheelRow
              key={wheel.id}
              wheel={wheel}
              partnerName={partnerName}
              onSpin={() => onSpin(wheel)}
              onEdit={() => onEdit(wheel)}
              onDelete={() => onDelete(wheel)}
              onToggleShared={() => onToggleShared(wheel)}
            />
          ))}
        </ul>
      )}

      {naming ? (
        <form className="filter-save-row wheel-pick-new" onSubmit={handleCreate}>
          <input
            className="filter-preset-input"
            type="text"
            placeholder="Name it"
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button
            type="submit"
            className="filter-save-button"
            disabled={newName.trim().length === 0}
          >
            Create
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="action-button settings-wide wheel-pick-new"
          onClick={() => setNaming(true)}
        >
          New wheel
        </button>
      )}
    </div>
  )
}
