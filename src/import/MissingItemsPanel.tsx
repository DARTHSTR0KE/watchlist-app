import { useState } from 'react'
import { buildPosterUrl } from '../wheel/posters'
import type { WatchlistDiff } from './watchlistWrites'

interface MissingItemsPanelProps {
  missingItems: WatchlistDiff['missingItems']
  onApply: (action: 'watched' | 'remove' | 'manual', itemIds: string[]) => Promise<void>
}

export function MissingItemsPanel({ missingItems, onApply }: MissingItemsPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)

  if (missingItems.length === 0) return null

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const apply = async (action: 'watched' | 'remove' | 'manual') => {
    if (selected.size === 0) return
    setApplying(true)
    await onApply(action, [...selected])
    setSelected(new Set())
    setApplying(false)
  }

  return (
    <div className="missing-panel">
      <p className="missing-panel-title">
        No longer in the file ({missingItems.length}) — select the ones below to act on
      </p>
      <div className="missing-panel-list">
        {missingItems.map((item) => {
          const posterUrl = buildPosterUrl(item.posterPath)
          const isSelected = selected.has(item.watchlistItemId)
          return (
            <button
              type="button"
              key={item.watchlistItemId}
              className={`missing-panel-item${isSelected ? ' missing-panel-item-selected' : ''}`}
              onClick={() => toggle(item.watchlistItemId)}
            >
              {posterUrl ? (
                <img className="missing-panel-poster" src={posterUrl} alt="" />
              ) : (
                <div className="missing-panel-poster missing-panel-poster-fallback" />
              )}
              <span className="missing-panel-item-title">{item.title}</span>
            </button>
          )
        })}
      </div>
      <div className="missing-panel-actions">
        <button
          type="button"
          className="action-button"
          disabled={selected.size === 0 || applying}
          onClick={() => apply('watched')}
        >
          I watched these
        </button>
        <button
          type="button"
          className="action-button"
          disabled={selected.size === 0 || applying}
          onClick={() => apply('remove')}
        >
          Remove these
        </button>
        <button
          type="button"
          className="action-button"
          disabled={selected.size === 0 || applying}
          onClick={() => apply('manual')}
        >
          Keep these
        </button>
      </div>
    </div>
  )
}
