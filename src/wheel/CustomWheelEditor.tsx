import { buildPosterUrl } from './posters'
import { CUSTOM_WHEEL_MAX } from './customWheels'
import type { CustomWheel } from './customWheels'
import { FilmPicker } from './FilmPicker'
import type { WheelItem } from './titles'

interface CustomWheelEditorProps {
  wheel: CustomWheel
  films: WheelItem[]
  userId: string
  partnerId: string | null
  partnerName: string | null
  onAddFilmId: (filmId: string) => Promise<void>
  onRemoveFilmId: (filmId: string) => void
  onBack: () => void
}

export function CustomWheelEditor({
  wheel,
  films,
  userId,
  partnerId,
  partnerName,
  onAddFilmId,
  onRemoveFilmId,
  onBack,
}: CustomWheelEditorProps) {
  const onWheel = new Set(films.map((film) => film.id))
  const full = films.length >= CUSTOM_WHEEL_MAX

  return (
    <div className="filter-sheet-overlay" onClick={onBack}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">{wheel.name}</h2>
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
                    {posterUrl ? (
                      <img className="picker-poster" src={posterUrl} alt="" aria-hidden="true" />
                    ) : (
                      <span className="picker-poster picker-poster-fallback" aria-hidden="true" />
                    )}
                    <span className="picker-title">
                      {film.title}
                      <span className="picker-year">{film.year > 0 ? ` ${film.year}` : ''}</span>
                    </span>
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
          partnerName={partnerName}
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
      </div>
    </div>
  )
}
