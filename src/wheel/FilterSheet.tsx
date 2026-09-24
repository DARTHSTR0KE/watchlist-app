import { useState } from 'react'
import {
  DEFAULT_FILTERS,
  RUNTIME_MIN,
  RUNTIME_STEP,
  decadesPresent,
  genreFacets,
  mostRestrictiveFilter,
  languageFacets,
  languageLabel,
  runtimeCeiling,
} from './filters'
import type { WheelFilters } from './filters'
import { Screen } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { Ground } from '../ui/Ground'
import { TINT, usePosterColors, vividness } from '../ui/posterColor'
import type { RGB } from '../ui/posterColor'
import { ScreenCharacter } from '../brand/Ambient'
import { describeFilters } from './filterSummary'
import { WHEEL_DRAW_SIZE } from './weightedDraw'
import type { WheelItem } from './titles'

interface FilterSheetProps {
  pool: WheelItem[]
  // What the wheel is using now, and the films it drew with it.
  applied: WheelFilters
  drawn: WheelItem[]
  // What is being edited here. Nothing reaches the wheel until Show.
  draft: WheelFilters
  watchedIds: Set<string>
  // Everything the wheel could draw from with a given set of filters.
  poolFor: (filters: WheelFilters) => WheelItem[]
  onDraftChange: (filters: WheelFilters) => void
  onApply: (filters: WheelFilters) => void
  onSavePreset: (name: string, filters: WheelFilters) => void
  onManagePresets: () => void
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

// Colours for the ground from the films that would be drawn: the three
// most vivid, never an average of all of them.
function pickTints(colors: RGB[]): RGB[] {
  return [...colors].sort((a, b) => vividness(b) - vividness(a)).slice(0, 3)
}

const tintsKey = (tints: readonly RGB[]) => tints.map((tint) => tint.join(',')).join('|')

export function FilterSheet({
  pool,
  applied,
  drawn,
  draft,
  watchedIds,
  poolFor,
  onDraftChange,
  onApply,
  onSavePreset,
  onManagePresets,
}: FilterSheetProps) {
  const [presetName, setPresetName] = useState('')
  // Chip counts, facets and the ticket all follow the draft.
  const filters = draft
  const onChange = onDraftChange

  const matching = poolFor(draft)
  const matchCount = matching.length
  const shown = Math.min(WHEEL_DRAW_SIZE, matchCount)
  const unchanged = JSON.stringify(draft) === JSON.stringify(applied)
  // The films this would put on the wheel: the ones already there while
  // nothing has changed, otherwise the first of what would match. Fixed
  // rather than sampled, so the ground doesn't reshuffle on every render.
  const preview = unchanged ? drawn : matching.slice(0, WHEEL_DRAW_SIZE)

  const colors = usePosterColors(matchCount === 0 ? [] : preview.map((item) => item.posterPath))
  // Nothing matching turns the ground rust at once, before any poster is
  // read; otherwise the ground holds its last colours until the new ones
  // are in, so it never flashes to a stand-in between draws.
  const [tints, setTints] = useState<readonly RGB[]>([TINT.amber])
  const nextTints =
    matchCount === 0 ? [TINT.rust] : colors === null ? null : colors.length > 0 ? pickTints(colors) : [TINT.amber]
  if (nextTints && tintsKey(nextTints) !== tintsKey(tints)) setTints(nextTints)

  const culprit = matchCount === 0 ? mostRestrictiveFilter(pool, draft, watchedIds) : null

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
    /* In place like every other section. The way out is in the header;
       only Show changes the wheel. */
    <Screen
      ground={<Ground tints={tints} />}
      character={matchCount === 0 ? <ScreenCharacter kind="bin" /> : undefined}
    >
      {matchCount === 0 ? (
        <Ticket
          heading="FILTERS"
          figure="Nothing matches"
          line={describeFilters(draft)}
          perforation={
            culprit && culprit.wouldMatch > 0
              ? `LOOSEN ${culprit.label.toUpperCase()} — THAT BRINGS BACK ${culprit.wouldMatch} FILM${culprit.wouldMatch === 1 ? '' : 'S'}`
              : 'CLEAR ALL TO START AGAIN'
          }
        />
      ) : (
        <Ticket heading="FILTERS" figure={`${shown} of ${matchCount}`} line={describeFilters(draft)} />
      )}

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
                onSavePreset(presetName.trim(), draft)
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
          {/* The only thing here that changes the wheel. */}
          <button
            type="button"
            className="btn-primary"
            disabled={matchCount === 0}
            onClick={() => onApply(draft)}
          >
            Show {shown} film{shown === 1 ? '' : 's'}
          </button>
        </div>
    </Screen>
  )
}
