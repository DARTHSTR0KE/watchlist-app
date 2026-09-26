import { useEffect, useState } from 'react'
import { Loading } from './Screen'

// Past this, it isn't loading any more, it's not answering.
const SLOW_MS = 10_000

/**
 * What shows while the app waits on Supabase before it can draw anything:
 * the goldfish going round, never a blank page. Usually hidden behind the
 * splash. If the wait runs long, it says so and offers to try again.
 */
export function StartupWait() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="startup-wait" role="status">
      <Loading>
        {slow ? "The database isn't answering. It may be having a moment." : 'Opening…'}
      </Loading>
      {slow && (
        <button type="button" className="btn-field" onClick={() => window.location.reload()}>
          Try again
        </button>
      )}
    </div>
  )
}
