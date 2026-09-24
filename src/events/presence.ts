import { supabase } from '../lib/supabaseClient'
import { logEvent } from './events'
import { recordMilestones, takeUnseenMilestone } from './milestones'
import type { MilestoneKey } from './milestones'
import { DbError, reportQuietly } from '../lib/dbError'
import { awayLong, openedTogether, tiredFish } from '../ambient/ambient'
import { setAmbient } from '../ambient/ambientStore'

// Stamps my last_open_at from the database clock and returns what it was.
export async function touchLastOpen(): Promise<string | null> {
  const { data, error } = await supabase.rpc('touch_last_open')
  if (error) throw DbError.from(error)
  return (data as string | null) ?? null
}

// Their id and when they last opened, in one go.
async function loadPartnerOpen(
  userId: string,
): Promise<{ partnerId: string | null; lastOpenAt: string | null }> {
  const { data: mine, error } = await supabase
    .from('profiles')
    .select('partner_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw DbError.from(error)
  const partnerId = mine?.partner_id ?? null
  if (!partnerId) return { partnerId: null, lastOpenAt: null }
  const { data: theirs, error: theirError } = await supabase
    .from('profiles')
    .select('last_open_at')
    .eq('id', partnerId)
    .maybeSingle()
  if (theirError) throw DbError.from(theirError)
  return { partnerId, lastOpenAt: theirs?.last_open_at ?? null }
}

// Today's opens so far, by the device's own midnight. Read from the event
// stream rather than kept on the phone, so either device counts the same.
async function countOpensToday(now: Date): Promise<number> {
  const midnight = new Date(now)
  midnight.setHours(0, 0, 0, 0)
  const { count, error } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'app_open')
    .gte('created_at', midnight.toISOString())
  if (error) throw DbError.from(error)
  return count ?? 0
}

export interface OpenSignals {
  // Undefined when the stamp failed — not the same as never opened.
  previousOpenAt: string | null | undefined
  opensBefore: number | null
  partnerId: string | null
  partnerLastOpenAt: string | null
  openedAt: Date
}

let signals: Promise<OpenSignals> | null = null
let signalsFor: string | null = null

/**
 * What this cold start knows about time and the other person, read once
 * and shared: the splash wants it within a second, the shell wants it for
 * milestones, and reading last_open_at twice would find the second read
 * already overwritten by the first.
 *
 * app_open is logged here, after today's opens are counted, so the count
 * never includes the open doing the counting.
 */
export function loadOpenSignals(userId: string): Promise<OpenSignals> {
  if (signals && signalsFor === userId) return signals
  signalsFor = userId
  const openedAt = new Date()
  signals = Promise.all([
    touchLastOpen().catch((error: unknown) => {
      reportQuietly('Stamping last_open_at', error)
      return undefined
    }),
    countOpensToday(openedAt).catch((error: unknown) => {
      reportQuietly("Counting today's opens", error)
      return null
    }),
    loadPartnerOpen(userId).catch((error: unknown) => {
      reportQuietly('Reading their last_open_at', error)
      return { partnerId: null, lastOpenAt: null }
    }),
  ]).then(([previousOpenAt, opensBefore, partner]) => {
    logEvent('app_open')
    const result: OpenSignals = {
      previousOpenAt,
      opensBefore,
      partnerId: partner.partnerId,
      partnerLastOpenAt: partner.lastOpenAt,
      openedAt,
    }
    // Everything else in the app that notices reads it from here.
    setAmbient({
      away: awayLong(previousOpenAt, openedAt),
      tired: tiredFish(opensBefore),
      together: openedTogether(partner.lastOpenAt, openedAt),
    })
    return result
  })
  return signals
}

export interface OpenResult {
  // The one line to show this open, if a milestone was reached since.
  milestone: MilestoneKey | null
}

let recorded = false

/**
 * What a cold start records beyond the signals: both_here when they
 * opened within ninety seconds of me, and any milestone reached since last
 * time. Once per page load; a second call returns null. Nothing in it can
 * fail loudly.
 */
export async function recordOpen(userId: string): Promise<OpenResult | null> {
  if (recorded) return null
  recorded = true

  const opened = await loadOpenSignals(userId)
  if (openedTogether(opened.partnerLastOpenAt, opened.openedAt)) {
    logEvent('both_here', { detail: { partner_opened_at: opened.partnerLastOpenAt } })
  }

  if (opened.previousOpenAt !== undefined) {
    await recordMilestones(userId, opened.previousOpenAt).catch((error: unknown) =>
      reportQuietly('Recording milestones', error),
    )
  }
  const milestone = await takeUnseenMilestone().catch((error: unknown) => {
    reportQuietly('Reading milestones', error)
    return null
  })

  return { milestone }
}
