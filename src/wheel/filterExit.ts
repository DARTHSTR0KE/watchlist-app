import { useSyncExternalStore } from 'react'

/**
 * How to leave Filters, when Filters is open. The header lives outside the
 * wheel screen, so the wheel screen registers its exit here and the header
 * shows a back control for as long as one is registered.
 */
type Exit = () => void

let exit: Exit | null = null
const listeners = new Set<() => void>()

export function setFilterExit(next: Exit | null): void {
  exit = next
  for (const listener of listeners) listener()
}

export function useFilterExit(): Exit | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => exit,
  )
}
