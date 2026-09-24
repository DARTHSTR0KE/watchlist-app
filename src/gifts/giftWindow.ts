import { LINE_TIME_ZONE } from '../social/splashLines'

/**
 * The December gift window, on one calendar: India time, the same zone the
 * database's own checks use, so the app and the trigger agree on which day
 * it is. The device clock only decides what the screen says; the database
 * decides what it accepts.
 */

export const OPENS_DAY = 1
// The last day anything can be left or changed. The 15th is Wrapped.
export const CLOSES_AFTER_DAY = 14
export const WRAPPED_DAY = 15

// The prompt comes on these days, or the first open after each, and no
// more than once for each.
export const PROMPT_DAYS = [1, 7, 13] as const

export const TRACK_MAX_BYTES = 8 * 1024 * 1024
export const MESSAGE_MAX_BYTES = 25 * 1024 * 1024
export const MESSAGE_MAX_SECONDS = 60

export interface CalendarDay {
  year: number
  // 1-12
  month: number
  day: number
}

export function calendarDay(now: Date): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LINE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return { year: read('year'), month: read('month'), day: read('day') }
}

export type WindowState = 'before' | 'open' | 'closed'

// Before 1 December, 1-14 December, or from the 15th to the end of the
// year. A new year starts "before" again.
export function giftWindow(now: Date): WindowState {
  const { month, day } = calendarDay(now)
  if (month < 12) return 'before'
  return day <= CLOSES_AFTER_DAY ? 'open' : 'closed'
}

// The year a gift belongs to: the Wrapped it will play in.
export function giftYear(now: Date): number {
  return calendarDay(now).year
}

/**
 * Which of the three prompts is due, if any: the latest prompt day on or
 * before today, within the window. Whether it has already been shown, and
 * whether anything has been left, is the caller's to check.
 */
export function promptDue(now: Date): number | null {
  if (giftWindow(now) !== 'open') return null
  const { day } = calendarDay(now)
  let due: number | null = null
  for (const promptDay of PROMPT_DAYS) if (day >= promptDay) due = promptDay
  return due
}

// Checked before an upload starts, so a file that is too big never leaves
// the phone. The bucket's own limit still applies after this.
export function tooBig(bytes: number, max: number): boolean {
  return bytes >= max
}

export function sizeLabel(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
