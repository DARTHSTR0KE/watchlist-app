/**
 * Cold start means this document has just been loaded, not that the app
 * came back to the foreground. A module-level flag is exactly that: it is
 * created when the bundle first evaluates and survives every resume,
 * every tab switch and every visibilitychange, because none of those
 * re-evaluate the module.
 *
 * sessionStorage would be wrong here — it survives a reload, which is a
 * cold start and should show the splash again.
 */
let answer: boolean | null = null

export function claimColdStart(): boolean {
  // Every call in this document gets the same answer. App mounts once and
  // useState holds the result from there, so the splash still shows only
  // once — and StrictMode invoking the initializer twice in development
  // can't turn the second call into a "no".
  if (answer === null) answer = true
  return answer
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
