import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CustomWheel } from './customWheels'

interface CustomWheelsScreenProps {
  wheels: CustomWheel[]
  selectedId: string | null
  onCreate: (name: string) => void
  onRename: (wheel: CustomWheel, name: string) => void
  onDelete: (wheel: CustomWheel) => void
  onToggleShared: (wheel: CustomWheel) => void
  onSpin: (wheel: CustomWheel) => void
  onEdit: (wheel: CustomWheel) => void
  onBack: () => void
}

function WheelRow({
  wheel,
  selected,
  onRename,
  onDelete,
  onToggleShared,
  onSpin,
  onEdit,
}: {
  wheel: CustomWheel
  selected: boolean
  onRename: (name: string) => void
  onDelete: () => void
  onToggleShared: () => void
  onSpin: () => void
  onEdit: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(wheel.name)

  const commit = () => {
    const name = draft.trim()
    setEditing(false)
    if (name.length > 0 && name !== wheel.name) onRename(name)
    else setDraft(wheel.name)
  }

  return (
    <li className={`wheel-row${selected ? ' wheel-row-selected' : ''}`}>
      <div className="wheel-row-body">
        {editing && wheel.isMine ? (
          <input
            className="preset-name-input"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(wheel.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="preset-name"
            onClick={() => wheel.isMine && setEditing(true)}
          >
            {wheel.name}
          </button>
        )}
        <p className="preset-summary">
          {wheel.filmCount} film{wheel.filmCount === 1 ? '' : 's'}
          {wheel.isMine ? '' : ' · shared with you'}
        </p>
      </div>

      <div className="wheel-row-actions">
        <button type="button" className="wheel-row-action" onClick={onSpin}>
          {selected ? 'Selected' : 'Spin'}
        </button>
        {/* Someone else's wheel is theirs to edit; this one is only spun. */}
        {wheel.isMine && (
          <>
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
          </>
        )}
      </div>
    </li>
  )
}

export function CustomWheelsScreen({
  wheels,
  selectedId,
  onCreate,
  onRename,
  onDelete,
  onToggleShared,
  onSpin,
  onEdit,
  onBack,
}: CustomWheelsScreenProps) {
  const [newName, setNewName] = useState('')

  const handleCreate = (event: FormEvent) => {
    event.preventDefault()
    const name = newName.trim()
    if (name.length === 0) return
    onCreate(name)
    setNewName('')
  }

  return (
    <div className="filter-sheet-overlay" onClick={onBack}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">My wheels</h2>
          <span className="filter-sheet-count">
            {wheels.length} wheel{wheels.length === 1 ? '' : 's'}
          </span>
        </div>

        <form className="filter-save-row" onSubmit={handleCreate}>
          <input
            className="filter-preset-input"
            type="text"
            placeholder="Name a new wheel"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" className="filter-save-button" disabled={newName.trim().length === 0}>
            Create
          </button>
        </form>

        {wheels.length === 0 ? (
          <p className="preset-empty">
            No wheels yet. Create one, then add films to it from your lists or straight from TMDB.
          </p>
        ) : (
          <ul className="preset-list">
            {wheels.map((wheel) => (
              <WheelRow
                key={wheel.id}
                wheel={wheel}
                selected={wheel.id === selectedId}
                onRename={(name) => onRename(wheel, name)}
                onDelete={() => onDelete(wheel)}
                onToggleShared={() => onToggleShared(wheel)}
                onSpin={() => onSpin(wheel)}
                onEdit={() => onEdit(wheel)}
              />
            ))}
          </ul>
        )}

        <div className="filter-sheet-actions">
          <button type="button" className="action-button primary" onClick={onBack}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
