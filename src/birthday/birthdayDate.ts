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
// The celebration runs on past midnight into the small hours of 1 October,
// and ends at this hour, local time.
const RUNS_UNTIL_HOUR = 5

export const PLAYED_KEY = 'spin-birthday-played'

// From midnight on 30 September to 05:00 on 1 October, device time.
export function isBirthday(now: Date = new Date()): boolean {
  if (now.getMonth() === BIRTHDAY_MONTH_INDEX && now.getDate() === BIRTHDAY_DATE) return true
  return now.getMonth() === BIRTHDAY_MONTH_INDEX + 1 && now.getDate() === 1 && now.getHours() < RUNS_UNTIL_HOUR
}

/**
 * The day a play counts against. The small hours of 1 October still belong
 * to the 30th, so a play at 23:00 isn't repeated at 00:30 just because the
 * calendar turned over.
 */
export function birthdayKey(now: Date = new Date()): string {
  if (now.getMonth() === BIRTHDAY_MONTH_INDEX + 1 && now.getDate() === 1 && now.getHours() < RUNS_UNTIL_HOUR) {
    return localDateKey(new Date(now.getFullYear(), BIRTHDAY_MONTH_INDEX, BIRTHDAY_DATE))
  }
  return localDateKey(now)
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
    return window.localStorage.getItem(PLAYED_KEY) === birthdayKey(now)
  } catch {
    return true
  }
}

/**
 * Back to never-played. Clearing all data has to reach this too: the
 * record lives in localStorage rather than the database, so a wipe that
 * only emptied tables would leave the app believing the video had already
 * run — and testing on the real date would then be silently skipped when
 * the day actually came.
 */
export function clearPlayedRecord(): boolean {
  try {
    window.localStorage.removeItem(PLAYED_KEY)
    return true
  } catch {
    return false
  }
}

// What the record holds right now, for the temporary check in Settings.
export function readPlayedRecord(): string | null {
  try {
    return window.localStorage.getItem(PLAYED_KEY)
  } catch {
    return null
  }
}

/**
 * TEMPORARY. Testing with the phone set to 30 September 2026 may have
 * written the real day into the record. Removed once, before the gate first
 * looks, on the first open of this build; a flag stops it running again, so
 * the real day's own record is never touched after that.
 */
const UNBURN_FLAG = 'spin-birthday-unburnt-2026'
export function unburnTestDay(): void {
  try {
    if (window.localStorage.getItem(UNBURN_FLAG)) return
    if (window.localStorage.getItem(PLAYED_KEY) === '2026-09-30') {
      window.localStorage.removeItem(PLAYED_KEY)
    }
    window.localStorage.setItem(UNBURN_FLAG, '1')
  } catch {
    // Nothing to do; Settings can clear it by hand.
  }
}

export function markPlayedToday(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(PLAYED_KEY, birthdayKey(now))
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
