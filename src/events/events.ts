import { supabase } from '../lib/supabaseClient'
import type { Json } from '../types/supabase'
import { reportQuietly } from '../lib/dbError'

/**
 * One row per thing that happened, in the order it happened.
 *
 * Nothing here is copied from another table. A spin's filters stay on the
 * spin, a rating stays on the watched row, a note stays on the
 * recommendation. An event says only what happened, to which film, and
 * when — plus, in detail, anything nothing else keeps.
 *
 * Logging is silent and never in the way: nothing is awaited by the
 * caller and nothing on screen changes. A failed write is not shown where
 * it happened, but its reason is kept for Settings to show.
 */

export const EVENT_TYPES = [
  'app_open',
  'spin',
  'reroll',
  'not_tonight',
  'watch_started',
  'watched_alone',
  'watched_together',
  'watch_abandoned',
  'recommendation_sent',
  'recommendation_accepted',
  'recommendation_passed',
  'nudge_sent',
  'splash_line_set',
  'wheel_created',
  'veto',
  'import_run',
  'filter_applied',
  'both_here',
  'tap_mascot',
  'secret_found',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export function logEvent(
  type: EventType,
  options: { filmId?: string | null; detail?: { [key: string]: Json | undefined } } = {},
): void {
  // user_id is left to the database, which fills it from the session.
  void supabase
    .from('events')
    .insert({ type, film_id: options.filmId ?? null, detail: options.detail ?? null })
    .then(
      ({ error }) => {
        if (error) reportQuietly(`Logging ${type}`, error)
      },
      (error: unknown) => reportQuietly(`Logging ${type}`, error),
    )
}
