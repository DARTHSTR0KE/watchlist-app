import { RATING_STEPS, starLabel } from '../wheel/filters'

interface RatingPickerProps {
  value: number | null
  onChange: (value: number | null) => void
}

// Half stars on the Letterboxd scale, plus the option of no score at all —
// watching something and not rating it is a normal outcome, not a gap.
export function RatingPicker({ value, onChange }: RatingPickerProps) {
  return (
    <div className="filter-chips filter-chips-tight">
      <button
        type="button"
        className={`filter-chip${value === null ? ' filter-chip-selected' : ''}`}
        aria-pressed={value === null}
        onClick={() => onChange(null)}
      >
        No rating
      </button>
      {RATING_STEPS.map((step) => (
        <button
          key={step}
          type="button"
          className={`filter-chip${value === step ? ' filter-chip-selected' : ''}`}
          aria-pressed={value === step}
          onClick={() => onChange(step)}
        >
          {starLabel(step)}
        </button>
      ))}
    </div>
  )
}
