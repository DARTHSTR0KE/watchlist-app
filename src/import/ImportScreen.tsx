import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useEnrichment } from './EnrichmentContext'
import { ReviewList } from './ReviewList'
import { ManualSearch } from './ManualSearch'
import { WatchlistGrid } from './WatchlistGrid'
import { MissingItemsPanel } from './MissingItemsPanel'
import { formatRelativeTime } from '../utils/relativeTime'
import {
  getLastImportDate,
  getWatchlistGrid,
  keepMissingItemsManually,
  markMissingAsWatched,
  removeMissingItems,
} from './watchlistWrites'
import type { WatchlistDiff, WatchlistGridItem } from './watchlistWrites'

interface ImportScreenProps {
  onGoToWheel: () => void
}

export function ImportScreen({ onGoToWheel }: ImportScreenProps) {
  const { session } = useAuth()
  const userId = session?.user.id ?? ''
  const {
    phase,
    watchlistProgress,
    watchedProgress,
    watchedRunning,
    pendingImport,
    reviewItems,
    error,
    startImport,
    confirmImport,
    resolveReviewItem,
  } = useEnrichment()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lastImportAt, setLastImportAt] = useState<string | null>(null)
  const [gridItems, setGridItems] = useState<WatchlistGridItem[]>([])
  const [remainingMissing, setRemainingMissing] = useState<WatchlistDiff['missingItems']>([])
  const [confirming, setConfirming] = useState(false)

  // Reset the locally-editable missing-items list whenever a new diff comes
  // in from the context (adjusting state during render, not in an effect —
  // see https://react.dev/learn/you-might-not-need-an-effect).
  const [seenPendingImport, setSeenPendingImport] = useState(pendingImport)
  if (pendingImport !== seenPendingImport) {
    setSeenPendingImport(pendingImport)
    setRemainingMissing(pendingImport ? pendingImport.diff.missingItems : [])
  }

  const refreshGrid = useCallback(async () => {
    if (!userId) return
    const [items, lastImport] = await Promise.all([getWatchlistGrid(userId), getLastImportDate(userId)])
    setGridItems(items)
    setLastImportAt(lastImport)
  }, [userId])

  useEffect(() => {
    void refreshGrid()
  }, [refreshGrid])

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !userId) return
    const filename = files.length === 1 ? files[0].name : `${files.length} files`
    await startImport(userId, files, filename)
    event.target.value = ''
  }

  const handleConfirm = async () => {
    setConfirming(true)
    await confirmImport(userId)
    setConfirming(false)
    await refreshGrid()
  }

  const handleApplyMissing = async (action: 'watched' | 'remove' | 'manual', itemIds: string[]) => {
    const filmIds = remainingMissing.filter((item) => itemIds.includes(item.watchlistItemId)).map((item) => item.filmId)
    if (action === 'watched') await markMissingAsWatched(userId, itemIds, filmIds)
    else if (action === 'remove') await removeMissingItems(itemIds)
    else await keepMissingItemsManually(itemIds)

    setRemainingMissing((prev) => prev.filter((item) => !itemIds.includes(item.watchlistItemId)))
    await refreshGrid()
  }

  const busy = phase === 'enriching-watchlist'

  return (
    <div className="import-screen">
      <div className="import-header">
        <h1 className="import-title">Your watchlist</h1>
        {lastImportAt && (
          <p className="import-last-updated">Watchlist last updated {formatRelativeTime(lastImportAt)}</p>
        )}
        {gridItems.length > 0 && (
          <button type="button" className="import-go-to-wheel" onClick={onGoToWheel}>
            Go to wheel
          </button>
        )}
      </div>

      <section className="import-file-picker">
        <p className="import-file-hint">
          Export your data from Letterboxd: Settings, Data, Export Your Data. Select the .zip it downloads, or the
          individual CSV files.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.csv"
          multiple
          className="import-file-input"
          onChange={handleFileChange}
          disabled={busy}
        />
      </section>

      {error && <p className="import-error">{error}</p>}

      {phase === 'enriching-watchlist' && watchlistProgress && (
        <div className="import-progress">
          <p className="import-progress-label">
            Matching your watchlist… {watchlistProgress.completed}/{watchlistProgress.total}
          </p>
          <div className="import-progress-track">
            <div
              className="import-progress-fill"
              style={{
                width: `${watchlistProgress.total > 0 ? (watchlistProgress.completed / watchlistProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {phase === 'awaiting-confirmation' && pendingImport && (
        <div className="import-summary">
          <p className="import-summary-line">
            {pendingImport.newEntries.length} new · {remainingMissing.length} no longer in the file ·{' '}
            {pendingImport.diff.unchangedCount} unchanged
          </p>
          <MissingItemsPanel missingItems={remainingMissing} onApply={handleApplyMissing} />
          <button type="button" className="spin-button" onClick={handleConfirm} disabled={confirming}>
            {confirming ? 'Saving…' : 'Confirm import'}
          </button>
        </div>
      )}

      {watchedRunning && watchedProgress && (
        <p className="import-watched-progress">
          Enriching watch history in the background… {watchedProgress.completed}/{watchedProgress.total}
        </p>
      )}

      <ReviewList items={reviewItems} onResolve={(item, choice) => resolveReviewItem(userId, item, choice)} />

      <ManualSearch userId={userId} onAdded={refreshGrid} />

      {gridItems.length > 0 ? (
        <WatchlistGrid items={gridItems} />
      ) : (
        phase === 'idle' && <p className="import-empty">No titles yet — import your Letterboxd export above.</p>
      )}
    </div>
  )
}
