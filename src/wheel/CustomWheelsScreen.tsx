import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CustomWheel } from './customWheels'
import { Empty, PosterStack, Row, Rows, Screen } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'

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
    <Row
      art={<PosterStack posterPaths={wheel.posterPaths} />}
      name={wheel.name}
      meta={
        <>
          {wheel.filmCount} film{wheel.filmCount === 1 ? '' : 's'}
          {!wheel.isMine && ` · from ${partnerName ?? 'them'}`}
        </>
      }
      onOpen={onSpin}
      actions={
        wheel.isMine ? (
          <>
            <button type="button" className="btn-row" onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className={`btn-row${wheel.shared ? ' btn-row-on' : ''}`}
              aria-pressed={wheel.shared}
              onClick={onToggleShared}
            >
              {wheel.shared ? 'Shared' : 'Share'}
            </button>
            <button type="button" className="btn-row btn-row-danger" onClick={onDelete}>
              Delete
            </button>
          </>
        ) : undefined
      }
    />
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
    <Screen>
      <Ticket
        heading="MY WHEELS"
        figure={`${wheels.length} wheel${wheels.length === 1 ? '' : 's'}`}
        line={`${wheels.filter((wheel) => wheel.shared).length} shared with both of you`}
      />

      {wheels.length === 0 ? (
        <Empty>
          No wheels yet. Make one, then fill it from a search, your lists, or an actor's films.
        </Empty>
      ) : (
        <Rows>
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
        </Rows>
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
        /* The one amber button on this screen. */
        <button type="button" className="btn-primary" onClick={() => setNaming(true)}>
          New wheel
        </button>
      )}
    </Screen>
  )
}
