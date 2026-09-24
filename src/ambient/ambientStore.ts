import { useSyncExternalStore } from 'react'

/**
 * What this open noticed about time and the two of you, for anything
 * outside the splash that wants to show it — the dust on the wheel, the
 * tired fish. Set once, when the open's signals arrive.
 */
export interface AmbientState {
  away: boolean
  tired: boolean
  together: boolean
}

let state: AmbientState = { away: false, tired: false, together: false }
const listeners = new Set<() => void>()

export function setAmbient(next: AmbientState): void {
  state = next
  for (const listener of listeners) listener()
}

export function useAmbient(): AmbientState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
