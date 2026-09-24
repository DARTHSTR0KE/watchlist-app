import { supabase } from '../lib/supabaseClient'
import type { Json } from '../types/supabase'

/**
 * Milestones are written once, the first time each is reached, and never
 * again — the primary key on (user_id, key) holds that, not this file.
 *
 * They are worked out when the app opens, from the tables that already
 * record what happened, so the date on each is when it actually happened
 * rather than when it was noticed. The only thing that surfaces is one
 * line, on the open after it was reached.
 */

export type MilestoneKey =
  | 'first_spin'
  | 'tenth_spin'
  | 'hundredth_spin'
  | 'five_hundredth_spin'
  | 'first_together'
  | 'tenth_together'
  | 'fiftieth_together'
  | 'first_recommendation_accepted'
  | 'first_nudge'
  | 'first_secret'
  | 'a_year_of_this'

export const SPIN_MILESTONES: [number, MilestoneKey][] = [
  [1, 'first_spin'],
  [10, 'tenth_spin'],
  [100, 'hundredth_spin'],
  [500, 'five_hundredth_spin'],
]

export const TOGETHER_MILESTONES: [number, MilestoneKey][] = [
  [1, 'first_together'],
  [10, 'tenth_together'],
  [50, 'fiftieth_together'],
]

export interface Occurrence {
  at: string
  filmId: string | null
  title: string | null
}

export interface MilestoneCandidate {
  key: MilestoneKey
  reachedAt: string
  detail: { [key: string]: Json }
}

/* ------------------------------------------------------------------ */
/* Working out what has been reached                                   */
/* ------------------------------------------------------------------ */

// The nth occurrence, in order, reaches the nth milestone — and its date
// and film are what get remembered.
export function countMilestones(
  occurrences: Occurrence[],
  thresholds: [number, MilestoneKey][],
): MilestoneCandidate[] {
  const ordered = [...occurrences].sort((a, b) => a.at.localeCompare(b.at))
  const reached: MilestoneCandidate[] = []
  for (const [count, key] of thresholds) {
    const occurrence = ordered[count - 1]
    if (!occurrence) continue
    reached.push({
      key,
      reachedAt: occurrence.at,
      detail: {
        count,
        film_id: occurrence.filmId,
        title: occurrence.title,
        date: occurrence.at.slice(0, 10),
      },
    })
  }
  return reached
}

export function firstMilestone(key: MilestoneKey, first: Occurrence | null): MilestoneCandidate[] {
  if (!first) return []
  return [
    {
      key,
      reachedAt: first.at,
      detail: { film_id: first.filmId, title: first.title, date: first.at.slice(0, 10) },
    },
  ]
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

// A year from the first thing either table remembers me doing.
export function yearOfThis(starts: (string | null)[], now: Date = new Date()): MilestoneCandidate[] {
  const known = starts.filter((start): start is string => start !== null).sort()
  const since = known[0]
  if (!since) return []
  const reached = new Date(new Date(since).getTime() + YEAR_MS)
  if (Number.isNaN(reached.getTime()) || reached > now) return []
  return [
    {
      key: 'a_year_of_this',
      reachedAt: reached.toISOString(),
      detail: { since: since.slice(0, 10), date: reached.toISOString().slice(0, 10) },
    },
  ]
}

/* ------------------------------------------------------------------ */
/* Saying it                                                           */
/* ------------------------------------------------------------------ */

export function milestoneLine(key: MilestoneKey, partnerName: string | null): string {
  const them = partnerName ?? 'they'
  switch (key) {
    case 'first_spin':
      return 'that was your first spin.'
    case 'tenth_spin':
      return 'that was your tenth spin.'
    case 'hundredth_spin':
      return 'that was your hundredth spin.'
    case 'five_hundredth_spin':
      return 'that was your five-hundredth spin.'
    case 'first_together':
      return 'that was your first film together.'
    case 'tenth_together':
      return 'that was your tenth film together.'
    case 'fiftieth_together':
      return 'that was your fiftieth film together.'
    case 'first_recommendation_accepted':
      return `that was the first recommendation of yours ${them} took.`
    case 'first_nudge':
      return 'that was your first nudge.'
    case 'first_secret':
      return 'that was your first secret.'
    case 'a_year_of_this':
      return "that's a year of this."
  }
}

/* ------------------------------------------------------------------ */
/* Reading and writing                                                 */
/* ------------------------------------------------------------------ */

type TitleJoin = { title: string } | null

async function spinOccurrences(userId: string): Promise<Occurrence[]> {
  const { data, error } = await supabase
    .from('spins')
    .select('film_id, created_at, films(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) throw error
  return ((data ?? []) as unknown as { film_id: string | null; created_at: string | null; films: TitleJoin }[])
    .filter((row) => row.created_at !== null)
    .map((row) => ({ at: row.created_at!, filmId: row.film_id, title: row.films?.title ?? null }))
}

// Together is one shared fact, so either of our rows counts, once per film.
async function togetherOccurrences(): Promise<Occurrence[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, watched_on, films(title)')
    .eq('together', true)
  if (error) throw error
  const earliest = new Map<string, Occurrence>()
  for (const row of (data ?? []) as unknown as {
    film_id: string
    watched_on: string | null
    films: TitleJoin
  }[]) {
    if (!row.watched_on) continue
    const existing = earliest.get(row.film_id)
    if (!existing || row.watched_on < existing.at) {
      earliest.set(row.film_id, { at: row.watched_on, filmId: row.film_id, title: row.films?.title ?? null })
    }
  }
  return [...earliest.values()]
}

// The first of mine they took: added to their list, or watched.
async function firstAcceptedRecommendation(userId: string): Promise<Occurrence | null> {
  const { data, error } = await supabase
    .from('recommendations')
    .select('film_id, responded_at, films(title)')
    .eq('from_user', userId)
    .in('status', ['queued', 'watched'])
    .not('responded_at', 'is', null)
    .order('responded_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as unknown as { film_id: string; responded_at: string; films: TitleJoin }
  return { at: row.responded_at, filmId: row.film_id, title: row.films?.title ?? null }
}

// Nudges replace each other in their own table, so only the event stream
// remembers the first one.
async function firstEvent(type: string): Promise<Occurrence | null> {
  const { data, error } = await supabase
    .from('events')
    .select('film_id, created_at')
    .eq('type', type)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? { at: data.created_at, filmId: data.film_id, title: null } : null
}

async function earliestOf(table: 'spins' | 'imports' | 'events', userId: string): Promise<string | null> {
  const { data } = await supabase
    .from(table as 'spins')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.created_at ?? null
}

/**
 * Writes whatever has been reached and isn't written yet. On the very
 * first open with this in place — no earlier open on record — everything
 * found is history rather than news, so it goes in already seen.
 */
export async function recordMilestones(userId: string, previousOpenAt: string | null): Promise<void> {
  const { data: existingRows, error } = await supabase.from('milestones').select('key')
  if (error) throw error
  const existing = new Set((existingRows ?? []).map((row) => row.key))

  const settle = <T,>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback)
  const [spins, together, accepted, nudge, secret, firstSpin, firstImport, firstEventAt] =
    await Promise.all([
      settle(spinOccurrences(userId), []),
      settle(togetherOccurrences(), []),
      settle(firstAcceptedRecommendation(userId), null),
      settle(firstEvent('nudge_sent'), null),
      settle(firstEvent('secret_found'), null),
      settle(earliestOf('spins', userId), null),
      settle(earliestOf('imports', userId), null),
      settle(earliestOf('events', userId), null),
    ])

  const reached = [
    ...countMilestones(spins, SPIN_MILESTONES),
    ...countMilestones(together, TOGETHER_MILESTONES),
    ...firstMilestone('first_recommendation_accepted', accepted),
    ...firstMilestone('first_nudge', nudge),
    ...firstMilestone('first_secret', secret),
    ...yearOfThis([firstSpin, firstImport, firstEventAt]),
  ].filter((candidate) => !existing.has(candidate.key))
  if (reached.length === 0) return

  const backfill = previousOpenAt === null
  const now = new Date().toISOString()
  await supabase.from('milestones').upsert(
    reached.map((candidate) => ({
      user_id: userId,
      key: candidate.key,
      reached_at: candidate.reachedAt,
      detail: candidate.detail,
      seen_at: backfill ? now : null,
    })),
    { onConflict: 'user_id,key', ignoreDuplicates: true },
  )
}

// One unseen milestone, the earliest reached, marked seen as it is taken.
// Two reached at once surface on two opens rather than as a list.
export async function takeUnseenMilestone(): Promise<MilestoneKey | null> {
  const { data, error } = await supabase
    .from('milestones')
    .select('key')
    .is('seen_at', null)
    .order('reached_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  await supabase
    .from('milestones')
    .update({ seen_at: new Date().toISOString() })
    .eq('key', data.key)
    .is('seen_at', null)
  return data.key as MilestoneKey
}
