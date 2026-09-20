import { supabase } from '../lib/supabaseClient'
import { clearPlayedRecord } from '../birthday/birthdayDate'

/**
 * Clearing everything, for both accounts.
 *
 * Two things are deliberately left alone. `films` is the shared TMDB
 * catalogue — nothing personal lives in it and rebuilding it means
 * re-fetching every title, so it stays. `profiles` stays too: the names and
 * the partner link are what makes the two accounts a pair, and wiping the
 * data should not cost you that. Only `onboarded_at` is cleared, so the
 * walkthrough runs again on an account that is genuinely empty.
 *
 * Neither account is deleted, and nothing here touches auth.
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
}

// Every count is of what the policies actually let me see, which for the
// per-person tables is my own rows. The other person's copies go too; they
// simply can't be counted from here, and the confirmation says so rather
// than quoting a number that only covers half of it.
async function countOf(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table as 'watched')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function countEverything(): Promise<DataCounts> {
  const [watchlist, watched, recommendations, wheels, sharedList, presets, spins, imports] =
    await Promise.all([
      countOf('watchlist_items'),
      countOf('watched'),
      countOf('recommendations'),
      countOf('custom_wheels'),
      countOf('shared_list_items'),
      countOf('filter_presets'),
      countOf('spins'),
      countOf('imports'),
    ])
  return { watchlist, watched, recommendations, wheels, sharedList, presets, spins, imports }
}

export function totalRecords(counts: DataCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}

export interface ClearResult {
  // What the counts came back as afterwards. Anything above zero is a row
  // a policy would not let this client delete.
  remaining: DataCounts
  survivors: string[]
  onboardingReset: boolean
  // The birthday video's record lives in localStorage, not the database.
  birthdayReset: boolean
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
}

/**
 * Deletes are checked by counting again afterwards rather than trusting the
 * response: a DELETE matching no rows succeeds in PostgREST exactly as a
 * DELETE that removed a thousand does. If a policy only permits deleting
 * your own rows, the other account's survive silently — so the caller is
 * told what is still there instead of being shown a clean result.
 */
export async function clearAllData(userId: string, partnerId: string | null): Promise<ClearResult> {
  const ids = partnerId ? [userId, partnerId] : [userId]

  // Wheel items are keyed by wheel, not by person, so the wheels have to be
  // looked up before they go or their films are orphaned.
  const { data: wheelRows } = await supabase.from('custom_wheels').select('id').in('user_id', ids)
  const wheelIds = (wheelRows ?? []).map((row) => row.id)
  if (wheelIds.length > 0) {
    await supabase.from('custom_wheel_items').delete().in('wheel_id', wheelIds)
  }

  await Promise.all([
    supabase.from('watchlist_items').delete().in('user_id', ids),
    supabase.from('watched').delete().in('user_id', ids),
    supabase.from('spins').delete().in('user_id', ids),
    supabase.from('filter_presets').delete().in('user_id', ids),
    supabase.from('imports').delete().in('user_id', ids),
    supabase.from('shared_list_items').delete().in('added_by', ids),
    // Either direction: a recommendation is one record belonging to both.
    supabase.from('recommendations').delete().in('from_user', ids),
    supabase.from('recommendations').delete().in('to_user', ids),
    // Not counted in the confirmation — a single pending line either way
    // isn't a number worth quoting — but it goes with everything else.
    supabase.from('nudges').delete().in('from_user', ids),
  ])
  await supabase.from('custom_wheels').delete().in('user_id', ids)

  // Asked for back, so "the walkthrough will run again" is something we
  // know rather than something we hope.
  const { data: reset } = await supabase
    .from('profiles')
    .update({ onboarded_at: null })
    .in('id', ids)
    .select('id')

  // Not a table, but it is data about this account all the same, and a
  // wipe that left it behind would quietly skip the video on the day.
  const birthdayReset = clearPlayedRecord()

  const remaining = await countEverything().catch(() => EMPTY_COUNTS)
  const survivors = (Object.keys(remaining) as (keyof DataCounts)[])
    .filter((key) => remaining[key] > 0)
    .map((key) => `${remaining[key]} in ${LABELS[key]}`)

  return { remaining, survivors, onboardingReset: (reset ?? []).length > 0, birthdayReset }
}
