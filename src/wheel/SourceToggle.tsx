import { SOURCE_LABELS } from './filters'
import type { WheelSource } from './filters'

const SOURCES: WheelSource[] = ['watchlist', 'rewatch', 'both-loved', 'custom']

interface SourceToggleProps {
  source: WheelSource
  // Absent when this account has no partner set, which makes "Both loved
  // it" impossible rather than merely empty.
  partnerAvailable: boolean
  onChange: (source: WheelSource) => void
}

export function SourceToggle({ source, partnerAvailable, onChange }: SourceToggleProps) {
  return (
    <div className="source-toggle" role="group" aria-label="Where the wheel draws from">
      {SOURCES.map((value) => {
        const unavailable = value === 'both-loved' && !partnerAvailable
        return (
          <button
            key={value}
            type="button"
            className={`source-option${value === source ? ' source-option-on' : ''}`}
            aria-pressed={value === source}
            disabled={unavailable}
            title={unavailable ? 'No partner is linked to this account' : undefined}
            onClick={() => onChange(value)}
          >
            {SOURCE_LABELS[value]}
          </button>
        )
      })}
    </div>
  )
}
