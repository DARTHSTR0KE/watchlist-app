/**
 * The day is a local-calendar fact, never a UTC one. 30 September in
 * Mumbai begins five and a half hours before it does in UTC, so a UTC
 * comparison would start the day at half past five in the morning and end
 * it at half past five the next — firing on the wrong evening and going
 * quiet while it is still the 30th.
 */

// September. Month indexes are zero-based, which is exactly the sort of
// thing that makes a date check wrong by one.
const BIRTHDAY_MONTH_INDEX = 8
const BIRTHDAY_DATE = 30

const PLAYED_KEY = 'spin-birthday-played'

export function isBirthday(now: Date = new Date()): boolean {
  return now.getMonth() === BIRTHDAY_MONTH_INDEX && now.getDate() === BIRTHDAY_DATE
}

// Built from local parts. toISOString() would be the same bug as above.
export function localDateKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Whether today's play has already happened. A storage failure counts as
 * played: if the record can't be read there is no way to avoid repeating,
 * and a video that reappears on every foreground is worse than one that
 * is missed.
 */
export function alreadyPlayedToday(now: Date = new Date()): boolean {
  try {
    return window.localStorage.getItem(PLAYED_KEY) === localDateKey(now)
  } catch {
    return true
  }
}

export function markPlayedToday(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(PLAYED_KEY, localDateKey(now))
  } catch {
    // Nothing to do. The next open treats an unreadable store as played.
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// Everything that has to be true for the video to appear unbidden.
export function shouldPlayOnOpen(now: Date = new Date()): boolean {
  return isBirthday(now) && !prefersReducedMotion() && !alreadyPlayedToday(now)
}
