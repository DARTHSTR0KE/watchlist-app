import { supabase } from '../lib/supabaseClient'
import { clearPlayedRecord } from '../birthday/birthdayDate'
import { clearSplashLineRecords } from '../social/splashLines'
import { forgetReunionDate } from '../reunion/reunion'

/**
 * Clearing everything, for both accounts.
 *
 * Two things are deliberately left alone. `films` is the shared TMDB
 * catalogue — nothing personal lives in it and rebuilding it means
 * re-fetching every title, so it stays. `profiles` stays too: the names and
 * the partner link are what makes the two accounts a pair, and wiping the
 * data should not cost you that.
 *
 * Neither account is deleted, and nothing here touches auth. The truth or
 * dare card deck stays too: it is the game, not anything either of us did.
 */

export interface DataCounts {
  watchlist: number
  watched: number
  recommendations: number
  wheels: number
  sharedList: number
  presets: number
  spins: number
  imports: number
  nudges: number
  splashLines: number
  events: number
  milestones: number
  wheelItems: number
  gameScores: number
  recordNotices: number
  truthOrDareTurns: number
  // Cards either of us has drawn. Left behind, they stay "already drawn"
  // and the decks look emptier than they are.
  seenCards: number
  // Profiles still holding a reunion date.
  reunionDates: number
}

export const EMPTY_COUNTS: DataCounts = {
  watchlist: 0,
  watched: 0,
  recommendations: 0,
  wheels: 0,
  sharedList: 0,
  presets: 0,
  spins: 0,
  imports: 0,
  nudges: 0,
  splashLines: 0,
  events: 0,
  milestones: 0,
  wheelItems: 0,
  gameScores: 0,
  recordNotices: 0,
  truthOrDareTurns: 0,
  seenCards: 0,
  reunionDates: 0,
}

// Both accounts, counted in the database past the per-person policies, so
// the confirmation and the re-count see exactly what the wipe reaches.
// Anything missing from the answer counts as zero.
export async function countEverything(): Promise<DataCounts> {
  const { data, error } = await supabase.rpc('pair_data_counts')
  if (error) throw error
  const counts = (data ?? {}) as Partial<Record<keyof DataCounts, number>>
  const result = { ...EMPTY_COUNTS }
  for (const key of Object.keys(EMPTY_COUNTS) as (keyof DataCounts)[]) {
    result[key] = Number(counts[key] ?? 0)
  }
  return result
}

export function totalRecords(counts: DataCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}

export interface ClearResult {
  // What the counts came back as afterwards, across both accounts.
  // Anything above zero survived the wipe.
  remaining: DataCounts
  survivors: string[]
  // The birthday video's record lives in localStorage, not the database.
  birthdayReset: boolean
  // The prompt's skip and the cached line, also in localStorage.
  splashLineReset: boolean
}
const LABELS: Record<keyof DataCounts, string> = {
  watchlist: 'watchlist',
  watched: 'watched',
  recommendations: 'recommendations',
  wheels: 'custom wheels',
  sharedList: 'the shared list',
  presets: 'filter presets',
  spins: 'spins',
  imports: 'import history',
  nudges: 'nudges',
  splashLines: 'splash lines',
  events: 'the event log',
  milestones: 'milestones',
  wheelItems: 'films on custom wheels',
  gameScores: 'game scores',
  recordNotices: 'record notices',
  truthOrDareTurns: 'truth or dare turns',
  seenCards: 'truth or dare cards marked as drawn',
  reunionDates: 'reunion dates',
}

/**
 * One database function clears both accounts. Deleting from here could
 * only ever reach my own rows: the delete policies are per person, and a
 * DELETE that matches nothing succeeds exactly like one that removed
 * everything. The re-count afterwards runs in the database too, so it sees
 * both accounts rather than only what my policies let me see.
 */
export async function clearAllData(): Promise<ClearResult> {
  const { error } = await supabase.rpc('clear_pair_data')
  if (error) throw error

  // The database has already cleared both dates; this empties the copy
  // this phone keeps, so the warmth goes at once.
  forgetReunionDate()

  // Not tables, but data on this phone all the same. A wipe that left the
  // birthday record behind would quietly skip the video on the day.
  const birthdayReset = clearPlayedRecord()
  const splashLineReset = clearSplashLineRecords()

  const remaining = await countEverything().catch(() => EMPTY_COUNTS)
  const survivors = (Object.keys(remaining) as (keyof DataCounts)[])
    .filter((key) => remaining[key] > 0)
    .map((key) => `${remaining[key]} in ${LABELS[key]}`)

  return { remaining, survivors, birthdayReset, splashLineReset }
}
