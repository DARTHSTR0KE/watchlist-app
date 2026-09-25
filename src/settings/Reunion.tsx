import { useState } from 'react'
import { SectionLabel } from '../ui/Screen'
import { describeError } from '../lib/dbError'
import { daysUntil, localDateString, saveReunionDate, useReunionDate } from '../reunion/reunion'

function countLine(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days > 1) return `${days} days`
  return 'Passed'
}

// The next time we see each other. Setting it here sets it for both.
export function Reunion() {
  const date = useReunionDate()
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const days = date ? daysUntil(date) : null

  const save = async (next: string | null) => {
    setSaving(true)
    setProblem(null)
    try {
      await saveReunionDate(next)
    } catch (error) {
      setProblem(`Couldn't save that: ${describeError(error)}`)
    }
    setSaving(false)
  }

  return (
    <section>
      <SectionLabel tone="rust">Seeing each other</SectionLabel>
      {days !== null && <p className="reunion-count">{countLine(days)}</p>}
      <div className="filter-save-row">
        <input
          className="filter-preset-input"
          type="date"
          value={date ?? ''}
          // From today on: a reunion is ahead of you.
          min={localDateString()}
          disabled={saving}
          onChange={(event) => void save(event.target.value === '' ? null : event.target.value)}
          aria-label="The date you next see each other"
        />
        {date && (
          <button
            type="button"
            className="filter-save-button reunion-clear"
            disabled={saving}
            onClick={() => void save(null)}
          >
            Clear
          </button>
        )}
      </div>
      {problem && <p className="line-meta line-error">{problem}</p>}
    </section>
  )
}
