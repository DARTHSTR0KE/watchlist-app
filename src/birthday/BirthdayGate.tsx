import { useEffect, useState } from 'react'
import { BirthdayVideo } from './BirthdayVideo'
import { markPlayedToday, shouldPlayOnOpen } from './birthdayDate'

/**
 * Sits above the auth gate on purpose. Someone opening this for the first
 * time should meet the video, not a password box — which also means it
 * cannot read anything server-side, since there is no session yet. Hence
 * localStorage for "already played today".
 */
export function BirthdayGate() {
  const [showing, setShowing] = useState(shouldPlayOnOpen)

  // A phone rarely starts an app cold. Coming back from the background is
  // an "open" too, so the check runs again — guarded by the same record,
  // so it still plays only once a day.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return
      if (shouldPlayOnOpen()) setShowing(true)
    }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])

  if (!showing) return null

  return (
    <BirthdayVideo
      recordPlayed
      onPlayed={markPlayedToday}
      onClose={() => setShowing(false)}
    />
  )
}
