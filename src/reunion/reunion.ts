import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DbError, reportQuietly } from '../lib/dbError'

/**
 * The date we next see each other, and how the app warms as it comes.
 *
 * profiles.reunion_date is one date on both rows: set_reunion_date writes
 * it to mine and theirs together, so whoever sets it sets it for both.
 *
 * Days are counted from local date parts only. A 'YYYY-MM-DD' handed to
 * new Date() is read as UTC midnight, and toISOString() hands back UTC —
 * either one moves the day by one for half the world at the wrong hour.
 */

// Today as 'YYYY-MM-DD', from the device's own calendar.
export function localDateString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Whole days from today to the date, in local days. Negative once past.
export function daysUntil(date: string, now: Date = new Date()): number | null {
  const [year, month, day] = date.split('-').map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return null
  const target = new Date(year, month - 1, day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Rounded, not floored: a day that crosses a clock change is 23 or 25
  // hours long, and it is still one day.
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * How warm the app is. Nothing says so; the grounds, the fish and the pair
 * simply change.
 *
 *   none  more than a week away, past, or no date
 *   week  within a week
 *   two   two days
 *   eve   the day before
 *   day   the day itself
 */
export type Warmth = 'none' | 'week' | 'two' | 'eve' | 'day'

export function warmthFor(days: number | null): Warmth {
  if (days === null || days < 0 || days > 7) return 'none'
  if (days === 0) return 'day'
  if (days === 1) return 'eve'
  if (days === 2) return 'two'
  return 'week'
}

/* ------------------------------------------------------------------ */
/* The shared date, held once for the whole app                        */
/* ------------------------------------------------------------------ */

let reunionDate: string | null = null
const listeners = new Set<() => void>()

// The last date seen, so a cold start is already warm on its first frame
// rather than warming a second later when the profile arrives.
const CACHE_KEY = 'reunion-date'

function readCache(): string | null {
  try {
    return window.localStorage.getItem(CACHE_KEY)
  } catch {
    return null
  }
}

function writeCache(date: string | null): void {
  try {
    if (date === null) window.localStorage.removeItem(CACHE_KEY)
    else window.localStorage.setItem(CACHE_KEY, date)
  } catch {
    // Only a head start.
  }
}

// The warmth lives on the root element, where the stylesheet reads it.
export function applyWarmth(now: Date = new Date()): Warmth {
  const warmth = warmthFor(reunionDate === null ? null : daysUntil(reunionDate, now))
  if (warmth === 'none') delete document.documentElement.dataset.warmth
  else document.documentElement.dataset.warmth = warmth
  return warmth
}

function setReunionState(date: string | null): void {
  reunionDate = date
  writeCache(date)
  applyWarmth()
  for (const listener of listeners) listener()
}

export function useReunionDate(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => reunionDate,
  )
}

// Called once, as early as possible, from whatever was seen last.
export function warmFromCache(): void {
  reunionDate = readCache()
  applyWarmth()
}

export async function loadReunionDate(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('reunion_date')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    // The cached date stands; the reason is kept for Settings.
    reportQuietly('Reading the reunion date', DbError.from(error))
    return
  }
  setReunionState(data?.reunion_date ?? null)
}

// Sets it, or clears it with null, on both of our rows at once.
export async function saveReunionDate(date: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_reunion_date', { p_date: date })
  if (error) throw DbError.from(error)
  setReunionState(date)
}
