import { useState } from 'react'
import { describeFilters } from './filterSummary'
import { MAX_STARRED_PRESETS } from './wheelPersistence'
import type { FilterPreset } from './wheelPersistence'

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
    <li className="preset-row">
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

      <div className="preset-row-body">
        {editing ? (
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
        )}
        <p className="preset-summary">{describeFilters(preset.filters)}</p>
      </div>

      <button type="button" className="preset-delete" onClick={onDelete} aria-label={`Delete ${preset.name}`}>
        Delete
      </button>
    </li>
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
    <div className="filter-sheet-overlay" onClick={onBack}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">Presets</h2>
          <span className="filter-sheet-count">
            {starredCount} of {MAX_STARRED_PRESETS} active
          </span>
        </div>

        <p className="preset-help">
          {atCap
            ? `${MAX_STARRED_PRESETS} of ${MAX_STARRED_PRESETS} active — unstar one to add another`
            : 'Starred presets appear as chips above the wheel.'}
        </p>

        {presets.length === 0 ? (
          <p className="preset-empty">
            No presets yet. Save a filter combination from the filters sheet.
          </p>
        ) : (
          <ul className="preset-list">
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
          </ul>
        )}

        <div className="filter-sheet-actions">
          <button type="button" className="action-button primary" onClick={onBack}>
            Back to filters
          </button>
        </div>
      </div>
    </div>
  )
}
