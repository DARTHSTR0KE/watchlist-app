import { useEffect, useState } from 'react'
import { SectionLabel } from '../ui/Screen'
import { clearAllData, countEverything, totalRecords } from './dangerZone'
import type { DataCounts } from './dangerZone'

interface ClearAllDataProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  // The shell reloads what it holds; nothing left on screen should still be
  // describing data that has just gone.
  onCleared: () => void
}

const CONFIRM_WORD = 'DELETE'

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Opens in place rather than over the screen, like everything else here.
 * The confirmation is a typed word and not a second tap: this wipes another
 * person's data as well as your own and there is no undo, so it should not
 * be reachable by two taps in the wrong place.
 */
export function ClearAllData({ userId, partnerId, partnerName, onCleared }: ClearAllDataProps) {
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<DataCounts | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void countEverything()
      .catch(() => null)
      .then((rows) => {
        if (!cancelled) setCounts(rows)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const them = partnerName ?? 'the other account'

  const handleClear = async () => {
    setBusy(true)
    setOutcome(null)
    try {
      const result = await clearAllData(userId, partnerId)
      onCleared()
      setOpen(false)
      setTyped('')
      setOutcome(
        result.survivors.length === 0
          ? result.onboardingReset
            ? 'Everything is gone, and the walkthrough will run again.'
            : "Everything is gone, but the walkthrough record couldn't be cleared, so it may not run again."
          : `Some rows a policy wouldn't let this app delete are still there: ${result.survivors.join(', ')}.`,
      )
    } catch {
      setOutcome("That didn't go through. Nothing is guaranteed to have been deleted.")
    }
    setBusy(false)
  }

  if (!open) {
    return (
      <section>
        <button type="button" className="btn-field btn-destructive" onClick={() => setOpen(true)}>
          Clear all data
        </button>
        {outcome && <p className="screen-empty">{outcome}</p>}
      </section>
    )
  }

  return (
    <section>
      <SectionLabel tone="rust">Clear all data</SectionLabel>

      <p className="screen-empty">
        This deletes everything for both accounts — yours and {them}'s. There is no undo.
      </p>

      {counts === null ? (
        <p className="screen-empty">Counting what's there…</p>
      ) : (
        <>
          <p className="screen-empty">
            {plural(counts.watchlist, 'film')} on the watchlist,{' '}
            {plural(counts.watched, 'watched record')}, {plural(counts.recommendations, 'recommendation')},{' '}
            {plural(counts.wheels, 'custom wheel')}, {plural(counts.sharedList, 'film')} on the shared
            list, {plural(counts.presets, 'filter preset')}, {plural(counts.spins, 'spin')},{' '}
            {plural(counts.imports, 'import')}, {plural(counts.nudges, 'nudge')},{' '}
            {plural(counts.splashLines, 'splash line')}, {plural(counts.events, 'logged event')},{' '}
            {plural(counts.milestones, 'milestone')}, {plural(counts.wheelItems, 'film')} on custom
            wheels, {plural(counts.gameScores, 'game score')},{' '}
            {plural(counts.recordNotices, 'record notice')},{' '}
            {plural(counts.truthOrDareTurns, 'truth or dare turn')},{' '}
            {plural(counts.seenCards, 'drawn card')} and{' '}
            {plural(counts.reunionDates, 'reunion date')} —{' '}
            {plural(totalRecords(counts), 'record')} in all.
          </p>
          <p className="screen-empty">
            That count is only what this account can see. {them}'s own watchlist, watched history,
            wheels, presets, spins, imports, events and milestones go as well, and can't be counted from here.
          </p>
        </>
      )}

      <p className="screen-empty">
        Kept: both names, the link between you, and the film catalogue. Neither account is deleted.
        The walkthrough will run again for both of you.
      </p>

      <label className="clear-confirm-label" htmlFor="clear-confirm">
        Type {CONFIRM_WORD} to confirm
      </label>
      <input
        id="clear-confirm"
        className="filter-preset-input clear-confirm-input"
        type="text"
        value={typed}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(event) => setTyped(event.target.value)}
      />

      <button
        type="button"
        className="btn-field btn-destructive"
        disabled={typed !== CONFIRM_WORD || busy}
        onClick={() => void handleClear()}
      >
        {busy ? 'Deleting…' : 'Delete everything for both of us'}
      </button>
      <button
        type="button"
        className="btn-field"
        disabled={busy}
        onClick={() => {
          setOpen(false)
          setTyped('')
        }}
      >
        Cancel
      </button>

      {outcome && <p className="screen-empty">{outcome}</p>}
    </section>
  )
}
