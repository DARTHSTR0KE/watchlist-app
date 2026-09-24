import { supabase } from '../lib/supabaseClient'

/**
 * The splash tagline, written by the other person. I write theirs, they
 * write mine, and neither of us can write our own — the policies see to
 * that, not this file.
 *
 * Changeable once a calendar month. The database decides, from set_at and
 * its own clock: a trigger refuses a second change in the same month and
 * stamps set_at itself. Everything here about months is only for saying
 * so in advance, and a wrong device clock can at worst make the screen
 * offer a change the database then turns down.
 */

export const SPLASH_LINE_MAX = 60

export const DEFAULT_TAGLINE = 'Indecisive about films. Never about you :3'

// The calendar the month is counted in, matching the trigger. A fixed zone
// rather than the device's, so both of us agree on when a month turns.
export const LINE_TIME_ZONE = 'Asia/Kolkata'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function monthParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LINE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  // Zero-based, like Date's own months.
  return { year: read('year'), month: read('month') - 1 }
}

// "2026-09", in the line's own calendar.
export function monthKey(date: Date): string {
  const { year, month } = monthParts(date)
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

// The first day of the month after the one a line was set in.
export function nextChangeMonth(setAt: string): {
  year: number
  month: number
} {
  const { year, month } = monthParts(new Date(setAt))
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
}

export function canChangeLine(setAt: string, now: Date = new Date()): boolean {
  return monthKey(new Date(setAt)) < monthKey(now)
}

// "1 November", with the year only when it isn't this one.
export function nextChangeLabel(setAt: string, now: Date = new Date()): string {
  const next = nextChangeMonth(setAt)
  const label = `1 ${MONTH_NAMES[next.month]}`
  return next.year === monthParts(now).year ? label : `${label} ${next.year}`
}

/* ------------------------------------------------------------------ */
/* Reading and writing                                                 */
/* ------------------------------------------------------------------ */

export interface SplashLine {
  line: string
  setAt: string
}

// The line written for me. Null when they haven't written one.
export async function loadLineForMe(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('splash_lines')
    .select('line')
    .eq('to_user', userId)
    .maybeSingle()
  if (error) throw error
  return data?.line ?? null
}

// The line I wrote for them, and when.
export async function loadLineFromMe(
  userId: string,
  partnerId: string,
): Promise<SplashLine | null> {
  const { data, error } = await supabase
    .from('splash_lines')
    .select('line, set_at')
    .eq('from_user', userId)
    .eq('to_user', partnerId)
    .maybeSingle()
  if (error) throw error
  return data ? { line: data.line, setAt: data.set_at } : null
}

// Raised by the trigger when the line has already changed this month.
export class LineLockedThisMonth extends Error {}

export async function saveLine(
  userId: string,
  partnerId: string,
  line: string,
): Promise<SplashLine> {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > SPLASH_LINE_MAX) {
    throw new Error(`A line is 1 to ${SPLASH_LINE_MAX} characters.`)
  }
  const { data, error } = await supabase
    .from('splash_lines')
    // set_at is left out on purpose: the trigger stamps it from the
    // database's clock, whatever this device thinks the time is.
    .upsert(
      { from_user: userId, to_user: partnerId, line: trimmed },
      { onConflict: 'from_user,to_user' },
    )
    .select('line, set_at')
    .single()
  if (error) {
    if (error.code === 'P0001') throw new LineLockedThisMonth(error.message)
    throw error
  }
  return { line: data.line, setAt: data.set_at }
}

/* ------------------------------------------------------------------ */
/* On this device                                                      */
/* ------------------------------------------------------------------ */

const SKIPPED_KEY = 'splash-line-prompt-skipped'
const CACHE_KEY = 'splash-line-for-me'

/**
 * A skip holds for the rest of the month it was made in, then the prompt
 * asks once more. Stored as the month, so there is nothing to expire.
 */
export function promptSkippedThisMonth(now: Date = new Date()): boolean {
  try {
    return window.localStorage.getItem(SKIPPED_KEY) === monthKey(now)
  } catch {
    // Unreadable storage would otherwise ask on every open.
    return true
  }
}

export function recordPromptSkipped(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(SKIPPED_KEY, monthKey(now))
  } catch {
    // Nothing to do; the prompt simply comes back next open.
  }
}

/**
 * Clearing all data reaches this too, or a skip from before the reset
 * would keep the prompt away until next month on an account that has just
 * lost its line. The cached line goes for the same reason.
 */
export function clearSplashLineRecords(): boolean {
  try {
    window.localStorage.removeItem(SKIPPED_KEY)
    window.localStorage.removeItem(CACHE_KEY)
    return true
  } catch {
    return false
  }
}

/**
 * The splash is up before any request can come back, so the last line
 * seen is kept here and shown straight away, then replaced if it changed.
 * Keyed by user, so a different sign-in on the same phone never shows
 * someone else's.
 */
export function cachedLineFor(userId: string): string | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: string; line?: string }
    return parsed.userId === userId && typeof parsed.line === 'string' ? parsed.line : null
  } catch {
    return null
  }
}

export function cacheLineFor(userId: string, line: string | null): void {
  try {
    if (line === null) window.localStorage.removeItem(CACHE_KEY)
    else window.localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, line }))
  } catch {
    // Only a head start; nothing depends on it.
  }
}
