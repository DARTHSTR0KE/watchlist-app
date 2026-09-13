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
import { Screen, ScreenHead } from '../ui/Screen'
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
    /* In place like every other section — no sheet, nothing dimmed. */
    <Screen>
      <ScreenHead
        title="Filters"
        status={`${matchCount} matching`}
        tone={matchCount === 0 ? 'rust' : 'amber'}
      />

        <section className="filter-group dim-type">
          <p className="section-label tone-dimension">Media type</p>
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
          <section className="filter-group dim-language">
            <p className="section-label tone-dimension">Language</p>
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
          <section className="filter-group dim-genre">
            <p className="section-label tone-dimension">Genre</p>
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

        <section className="filter-group dim-slider">
          <p className="section-label tone-dimension">
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
          <section className="filter-group dim-slider">
            <p className="section-label tone-dimension">Release decade</p>
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

        {/* Everything in the watched sources is watched, so this would only
            ever empty the wheel there. */}
        {filters.source === 'watchlist' && (
          <section className="filter-group dim-toggle">
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={filters.excludeWatched}
                onChange={(event) => onChange({ ...filters, excludeWatched: event.target.checked })}
              />
              Exclude anything I've already watched
            </label>
          </section>
        )}

        <section className="filter-group">
          <p className="section-label tone-dimension">Save these filters</p>
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

        <div className="filter-actions">
          {/* Reset clears the filters, not the source — you chose the wheel
              you are on, so resetting shouldn't move you off it. */}
          <button
            type="button"
            className="btn-field"
            onClick={() => onChange({ ...DEFAULT_FILTERS, source: filters.source })}
          >
            Clear all
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Show {matchCount} film{matchCount === 1 ? '' : 's'}
          </button>
        </div>
    </Screen>
  )
}
