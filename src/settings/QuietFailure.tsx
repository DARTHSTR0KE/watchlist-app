import { useSyncExternalStore } from 'react'
import { SectionLabel } from '../ui/Screen'
import { lastQuietFailure, subscribeQuietFailures } from '../lib/dbError'

/**
 * The event log, milestones, the last-open stamp and the splash's own
 * fetch all fail without a word where they happen. This is where the
 * word goes: the latest such failure this session, in the database's own
 * terms. Nothing shows when nothing has failed.
 */
export function QuietFailure() {
  const failure = useSyncExternalStore(subscribeQuietFailures, lastQuietFailure)
  if (!failure) return null
  return (
    <section>
      <SectionLabel tone="rust">Something failed in the background</SectionLabel>
      <p className="screen-empty">
        {failure.where}, at {new Date(failure.at).toLocaleTimeString()}: {failure.report}
      </p>
    </section>
  )
}
