import { lazy } from 'react'
import type { ComponentType } from 'react'

/**
 * A screen loaded as its own file, which survives a deploy.
 *
 * After a push to main the app still opens on the old build, which the
 * old service worker serves from its cache. The new service worker takes
 * over a few seconds later and deletes the old build's files. A screen
 * that hasn't been loaded yet then asks for a file that no longer exists,
 * the import fails, and React has nothing to render.
 *
 * So: fetch it early, while the old files are still there, and if it
 * fails anyway reload once onto the new build and reopen the same screen.
 */

const RELOADED_AT = 'lazy-screen-reloaded-at'
const REOPEN = 'lazy-screen-reopen'
// A second failure within this long is a real one, not a deploy: it goes
// to the screen's error boundary rather than round a reload loop.
const RELOAD_GUARD_MS = 30_000

function reloadedRecently(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(RELOADED_AT))
    return Number.isFinite(at) && Date.now() - at < RELOAD_GUARD_MS
  } catch {
    // No storage means no guard: never reload.
    return true
  }
}

// The screen to reopen after a reload, read once and forgotten.
export function takeReopenScreen(): string | null {
  try {
    const screen = window.sessionStorage.getItem(REOPEN)
    window.sessionStorage.removeItem(REOPEN)
    return screen
  } catch {
    return null
  }
}

export function lazyScreen<Props extends object>(
  screen: string,
  load: () => Promise<ComponentType<Props>>,
) {
  let pending: Promise<{ default: ComponentType<Props> }> | null = null
  const fetchOnce = () => {
    pending ??= load()
      .then((component) => ({ default: component }))
      .catch((error: unknown) => {
        // Let a later attempt try the network again.
        pending = null
        throw error
      })
    return pending
  }

  const Component = lazy(() =>
    fetchOnce().catch((error: unknown) => {
      if (reloadedRecently()) throw error
      try {
        window.sessionStorage.setItem(RELOADED_AT, String(Date.now()))
        window.sessionStorage.setItem(REOPEN, screen)
      } catch {
        throw error
      }
      window.location.reload()
      // Nothing to render while the page goes.
      return new Promise<never>(() => {})
    }),
  )

  // Fetched as soon as the app is idle after opening, so it is already in
  // hand before a new service worker can clear the old build away.
  const prefetch = () => {
    void fetchOnce().catch(() => {
      // Tried again, with the reload behind it, when the screen is opened.
    })
  }

  return { Component, prefetch }
}
