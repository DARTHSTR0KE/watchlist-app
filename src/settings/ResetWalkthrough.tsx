import { useState } from 'react'
import { describeError } from '../lib/dbError'
import { resetPartnerWalkthrough } from './masterAccount'

/**
 * Master account only. Turns the walkthrough back on for ac, deliberately,
 * before handing the phone over. Clear all data no longer does this.
 */
export function ResetWalkthrough({ partnerName }: { partnerName: string | null }) {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const who = partnerName ?? 'ac'

  const reset = async () => {
    setBusy(true)
    setOutcome(null)
    try {
      const { was } = await resetPartnerWalkthrough()
      setOutcome(
        was
          ? `Done. ${who}'s walkthrough will run on ${who}'s next open (it was finished on ${new Date(was).toLocaleDateString()}). Yours is untouched.`
          : `Done. ${who}'s walkthrough was already reset, so it will run on ${who}'s next open. Yours is untouched.`,
      )
    } catch (error) {
      setOutcome(`That didn't go through: ${describeError(error)}`)
    }
    setBusy(false)
  }

  return (
    <section>
      <button type="button" className="btn-field" disabled={busy} onClick={() => void reset()}>
        {busy ? 'Resetting…' : `Reset the walkthrough for ${who}`}
      </button>
      {outcome && <p className="filter-hint">{outcome}</p>}
    </section>
  )
}
