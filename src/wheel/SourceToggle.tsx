import { SOURCE_LABELS } from './filters'
import type { WheelSource } from './filters'

const SOURCES: WheelSource[] = ['watchlist', 'shared', 'custom']

interface SourceToggleProps {
  source: WheelSource
  onChange: (source: WheelSource) => void
}

export function SourceToggle({ source, onChange }: SourceToggleProps) {
  return (
    <div className="source-toggle" role="group" aria-label="Where the wheel draws from">
      {SOURCES.map((value) => (
        <button
          key={value}
          type="button"
          className={`source-option${value === source ? ' source-option-on' : ''}`}
          aria-pressed={value === source}
          onClick={() => onChange(value)}
        >
          {SOURCE_LABELS[value]}
        </button>
      ))}
    </div>
  )
}
