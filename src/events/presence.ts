import { supabase } from '../lib/supabaseClient'
import { logAppOpenOnce, logEvent } from './events'
import { recordMilestones, takeUnseenMilestone } from './milestones'
import type { MilestoneKey } from './milestones'

/**
 * Whether the other person is around, read from when they last opened
 * the app. Opened within this window counts as here.
 */
export const AROUND_WINDOW_MS = 15 * 60 * 1000

export function isAround(lastOpenAt: string | null, now: Date = new Date()): boolean {
  if (!lastOpenAt) return false
  const then = new Date(lastOpenAt).getTime()
  if (Number.isNaN(then)) return false
  return now.getTime() - then <= AROUND_WINDOW_MS
}

// Stamps my last_open_at from the database clock and returns what it was.
export async function touchLastOpen(): Promise<string | null> {
  const { data, error } = await supabase.rpc('touch_last_open')
  if (error) throw error
  return (data as string | null) ?? null
}

export async function loadLastOpen(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('last_open_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.last_open_at ?? null
}

export interface OpenResult {
  partnerLastOpenAt: string | null
  partnerAround: boolean
  // The one line to show this open, if a milestone was reached since.
  milestone: MilestoneKey | null
}

/**
 * Everything a cold start records, in order: the open itself, my
 * last_open_at, whether they are here too, and any milestone reached
 * since last time. Runs once per page load; a second call returns null.
 * Nothing in it can fail loudly.
 */
export async function recordOpen(userId: string, partnerId: string | null): Promise<OpenResult | null> {
  if (!logAppOpenOnce()) return null

  const [previousOpenAt, partnerLastOpenAt] = await Promise.all([
    // Undefined when the stamp failed, so a failure is not mistaken for a
    // first open and everything reached so far filed away unannounced.
    touchLastOpen().catch(() => undefined),
    partnerId ? loadLastOpen(partnerId).catch(() => null) : Promise.resolve(null),
  ])

  const partnerAround = isAround(partnerLastOpenAt)
  if (partnerAround) logEvent('both_here', { detail: { partner_opened_at: partnerLastOpenAt } })

  if (previousOpenAt !== undefined) {
    await recordMilestones(userId, previousOpenAt).catch(() => {})
  }
  const milestone = await takeUnseenMilestone().catch(() => null)

  return { partnerLastOpenAt, partnerAround, milestone }
}
