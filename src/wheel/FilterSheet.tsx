import { useState } from 'react'
import {
  DEFAULT_FILTERS,
  RUNTIME_MIN,
  RUNTIME_STEP,
  decadesPresent,
  genreFacets,
  languageFacets,
  languageLabel,
  runtimeCeiling,
} from './filters'
import type { WheelFilters } from './filters'
import type { WheelItem } from './titles'

interface FilterSheetProps {
  pool: WheelItem[]
  filters: WheelFilters
  watchedIds: Set<string>
  matchCount: number
  onChange: (filters: WheelFilters) => void
  onSavePreset: (name: string) => void
  onManagePresets: () => void
  onClose: () => void
}

function Chip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`filter-chip${selected ? ' filter-chip-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      {label} <span className="filter-chip-count">{count}</span>
    </button>
  )
}

export function FilterSheet({
  pool,
  filters,
  watchedIds,
  matchCount,
  onChange,
  onSavePreset,
  onManagePresets,
  onClose,
}: FilterSheetProps) {
  const [presetName, setPresetName] = useState('')

  const languages = languageFacets(pool, filters, watchedIds)
  const genres = genreFacets(pool, filters, watchedIds)
  const decades = decadesPresent(pool)
  const ceiling = runtimeCeiling(pool)
  // One step past the longest title means "no limit".
  const noLimitValue = ceiling + RUNTIME_STEP
  const runtimeValue = filters.maxRuntime ?? noLimitValue

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">Filters</h2>
          <span className="filter-sheet-count">{matchCount} matching</span>
        </div>

        <section className="filter-group">
          <p className="filter-group-title">Media type</p>
          <div className="filter-segmented">
            {(
              [
                ['both', 'Both'],
                ['movie', 'Films'],
                ['tv', 'Shows'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`filter-segment${filters.mediaType === value ? ' filter-segment-active' : ''}`}
                onClick={() => onChange({ ...filters, mediaType: value })}
                aria-pressed={filters.mediaType === value}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {languages.length > 0 && (
          <section className="filter-group">
            <p className="filter-group-title">Language</p>
            <div className="filter-chips">
              {languages.map((facet) => (
                <Chip
                  key={facet.value}
                  label={languageLabel(facet.value)}
                  count={facet.count}
                  selected={filters.languages.includes(facet.value)}
                  onClick={() =>
                    onChange({ ...filters, languages: toggleIn(filters.languages, facet.value) })
                  }
                />
              ))}
            </div>
          </section>
        )}

        {genres.length > 0 && (
          <section className="filter-group">
            <p className="filter-group-title">Genre</p>
            <div className="filter-chips">
              {genres.map((facet) => (
                <Chip
                  key={facet.value}
                  label={facet.value}
                  count={facet.count}
                  selected={filters.genres.includes(facet.value)}
                  onClick={() => onChange({ ...filters, genres: toggleIn(filters.genres, facet.value) })}
                />
              ))}
            </div>
          </section>
        )}

        <section className="filter-group">
          <p className="filter-group-title">
            Maximum runtime{' '}
            <span className="filter-group-value">
              {filters.maxRuntime === null ? 'No limit' : `${filters.maxRuntime} min`}
            </span>
          </p>
          <input
            className="filter-range"
            type="range"
            min={RUNTIME_MIN}
            max={noLimitValue}
            step={RUNTIME_STEP}
            value={runtimeValue}
            onChange={(event) => {
              const next = Number(event.target.value)
              onChange({ ...filters, maxRuntime: next >= noLimitValue ? null : next })
            }}
          />
        </section>

        {decades.length > 0 && (
          <section className="filter-group">
            <p className="filter-group-title">Release decade</p>
            <div className="filter-decades">
              <select
                className="filter-select"
                value={filters.decadeFrom ?? ''}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    decadeFrom: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
                aria-label="Earliest decade"
              >
                <option value="">Earliest</option>
                {decades.map((decade) => (
                  <option key={decade} value={decade}>
                    {decade}s
                  </option>
                ))}
              </select>
              <span className="filter-decades-sep">to</span>
              <select
                className="filter-select"
                value={filters.decadeTo ?? ''}
                onChange={(event) =>
                  onChange({
                    ...filters,
                    decadeTo: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
                aria-label="Latest decade"
              >
                <option value="">Latest</option>
                {decades.map((decade) => (
                  <option key={decade} value={decade}>
                    {decade}s
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        <section className="filter-group">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filters.excludeWatched}
              onChange={(event) => onChange({ ...filters, excludeWatched: event.target.checked })}
            />
            Exclude anything I've already watched
          </label>
        </section>

        <section className="filter-group">
          <p className="filter-group-title">Save these filters</p>
          <div className="filter-save-row">
            <input
              className="filter-preset-input"
              type="text"
              placeholder="Name this combination"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
            />
            <button
              type="button"
              className="filter-save-button"
              disabled={presetName.trim().length === 0}
              onClick={() => {
                onSavePreset(presetName.trim())
                setPresetName('')
              }}
            >
              Save
            </button>
          </div>
        </section>

        <button type="button" className="preset-manage-link" onClick={onManagePresets}>
          Manage presets
        </button>

        <div className="filter-sheet-actions">
          <button type="button" className="action-button" onClick={() => onChange(DEFAULT_FILTERS)}>
            Clear all
          </button>
          <button type="button" className="action-button primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
