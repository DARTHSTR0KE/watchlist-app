import { useState } from 'react'
import { describeFilters } from './filterSummary'
import { MAX_STARRED_PRESETS } from './wheelPersistence'
import type { FilterPreset } from './wheelPersistence'
import { Empty, Row, Rows, Screen } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { Ground } from '../ui/Ground'
import { TINT } from '../ui/posterColor'

interface PresetsScreenProps {
  presets: FilterPreset[]
  onToggleStar: (preset: FilterPreset) => void
  onRename: (preset: FilterPreset, name: string) => void
  onDelete: (preset: FilterPreset) => void
  onBack: () => void
}

function PresetRow({
  preset,
  starDisabled,
  onToggleStar,
  onRename,
  onDelete,
}: {
  preset: FilterPreset
  starDisabled: boolean
  onToggleStar: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(preset.name)
  const starred = preset.starredAt !== null

  const commit = () => {
    const name = draft.trim()
    setEditing(false)
    if (name.length > 0 && name !== preset.name) onRename(name)
    else setDraft(preset.name)
  }

  return (
    <Row
      art={
        <button
          type="button"
          className={`preset-star${starred ? ' preset-star-on' : ''}`}
          onClick={onToggleStar}
          disabled={starDisabled}
          aria-pressed={starred}
          aria-label={starred ? `Unstar ${preset.name}` : `Star ${preset.name}`}
        >
          {starred ? '★' : '☆'}
        </button>
      }
      name={
        editing ? (
          <input
            className="preset-name-input"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(preset.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button type="button" className="preset-name" onClick={() => setEditing(true)}>
            {preset.name}
          </button>
        )
      }
      meta={describeFilters(preset.filters)}
      actions={
        <button
          type="button"
          className="btn-row btn-row-danger"
          onClick={onDelete}
          aria-label={`Delete ${preset.name}`}
        >
          Delete
        </button>
      }
    />
  )
}

export function PresetsScreen({
  presets,
  onToggleStar,
  onRename,
  onDelete,
  onBack,
}: PresetsScreenProps) {
  const starredCount = presets.filter((preset) => preset.starredAt !== null).length
  const atCap = starredCount >= MAX_STARRED_PRESETS

  return (
    <Screen ground={<Ground tints={[TINT.amber, TINT.mauve]} />}>
      <Ticket
        heading="PRESETS"
        figure={`${starredCount} of ${MAX_STARRED_PRESETS} active`}
        line={`${presets.length} saved`}
        perforation={
          atCap ? 'UNSTAR ONE TO ADD ANOTHER' : 'STARRED ONES SHOW AS CHIPS ABOVE THE WHEEL'
        }
      />

      {presets.length === 0 ? (
        <Empty>No presets yet. Save a filter combination from the filters screen.</Empty>
      ) : (
        <Rows>
          {presets.map((preset) => (
            <PresetRow
              key={preset.id}
              preset={preset}
              // Only unstarred rows lock at the cap; a starred one must
              // stay clickable so it can be unstarred.
              starDisabled={atCap && preset.starredAt === null}
              onToggleStar={() => onToggleStar(preset)}
              onRename={(name) => onRename(preset, name)}
              onDelete={() => onDelete(preset)}
            />
          ))}
        </Rows>
      )}

      <button type="button" className="btn-field" onClick={onBack}>
        Back to filters
      </button>
    </Screen>
  )
}
