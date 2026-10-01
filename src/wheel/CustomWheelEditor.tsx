import { useState } from 'react'
import { buildPosterUrl } from './posters'
import { CUSTOM_WHEEL_MAX } from './customWheels'
import type { CustomWheel } from './customWheels'
import { FilmPicker } from './FilmPicker'
import type { WheelItem } from './titles'
import { watchFilmNow } from '../import/watchlistWrites'
import { FilmDetailModal } from '../film/FilmDetailModal'

interface CustomWheelEditorProps {
  wheel: CustomWheel
  films: WheelItem[]
  userId: string
  partnerId: string | null
  onAddFilmId: (filmId: string) => Promise<void>
  onRemoveFilmId: (filmId: string) => void
  // The name is the heading, so renaming belongs here now that the list
  // is a list of wheels rather than a panel for managing them.
  onRename: (name: string) => void
  onBack: () => void
}

export function CustomWheelEditor({
  wheel,
  films,
  userId,
  partnerId,
  onAddFilmId,
  onRemoveFilmId,
  onRename,
  onBack,
}: CustomWheelEditorProps) {
  const [editingName, setEditingName] = useState(false)
  const [open, setOpen] = useState<WheelItem | null>(null)
  const [draft, setDraft] = useState(wheel.name)

  const commitName = () => {
    const name = draft.trim()
    setEditingName(false)
    if (name.length > 0 && name !== wheel.name) onRename(name)
    else setDraft(wheel.name)
  }
  const onWheel = new Set(films.map((film) => film.id))
  const full = films.length >= CUSTOM_WHEEL_MAX

  return (
    /* A screen, not a panel. Filling a wheel means searching and scrolling
       a filmography, which is a long task and wants the whole display. */
    <div className="list-screen wheel-editor">
      <div className="wheel-editor-head">
        <button type="button" className="wheel-row-action" onClick={onBack}>
          Back
        </button>
        {editingName ? (
          <input
            className="preset-name-input wheel-editor-title"
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitName()
              if (event.key === 'Escape') {
                setDraft(wheel.name)
                setEditingName(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="wheel-editor-title wheel-editor-rename"
            onClick={() => setEditingName(true)}
          >
            {wheel.name}
          </button>
        )}
        <span className="filter-sheet-count">
          {films.length} of {CUSTOM_WHEEL_MAX}
        </span>
      </div>

      <section className="filter-group">
        <p className="filter-group-title">On this wheel</p>
        {films.length === 0 ? (
          <p className="preset-empty">Nothing on it yet.</p>
        ) : (
          <ul className="picker-list">
            {films.map((film) => {
              const posterUrl = buildPosterUrl(film.posterPath)
              return (
                <li className="picker-row" key={film.id}>
                  {/* Poster and title open the film; Remove stays its own tap. */}
                  <button
                    type="button"
                    className="picker-row-open"
                    onClick={() => setOpen(film)}
                    aria-label={`Open ${film.title}`}
                  >
                    {posterUrl ? (
                      <img className="picker-poster" src={posterUrl} alt="" aria-hidden="true" />
                    ) : (
                      <span className="picker-poster picker-poster-fallback" aria-hidden="true" />
                    )}
                    <span className="picker-title">
                      {film.title}
                      <span className="picker-year">{film.year > 0 ? ` ${film.year}` : ''}</span>
                    </span>
                  </button>
                  {/* Permanent, unlike "Not tonight". */}
                  <button
                    type="button"
                    className="preset-delete"
                    onClick={() => onRemoveFilmId(film.id)}
                    aria-label={`Remove ${film.title} from this wheel`}
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <FilmPicker
        userId={userId}
        partnerId={partnerId}
        existingIds={onWheel}
        full={full}
        fullMessage={`A wheel holds ${CUSTOM_WHEEL_MAX} films. Remove one to add another.`}
        onAdd={onAddFilmId}
      />

      <div className="filter-sheet-actions">
      <button type="button" className="action-button primary" onClick={onBack}>
        Done
      </button>
      </div>

      {open && (
        <FilmDetailModal
          film={{ filmId: open.id, title: open.title, posterPath: open.posterPath }}
          context="list"
          handlers={{
            // The wheel's Watch this; it stays on this wheel, as when spun.
            watch: () => watchFilmNow(userId, open.id),
            'remove-list': async () => onRemoveFilmId(open.id),
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}
