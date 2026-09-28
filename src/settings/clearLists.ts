/**
 * What Clear all data wipes and what it must leave alone, as plain lists.
 * The wipe itself is clear_pair_data in pair-admin.sql; the tests hold that
 * function to these lists.
 */

// A table cleared by deleting every row whose column holds either of our ids.
export interface RowDelete {
  table: string
  column: string
}

export const ROW_DELETES: readonly RowDelete[] = [
  { table: 'watchlist_items', column: 'user_id' },
  { table: 'watched', column: 'user_id' },
  { table: 'spins', column: 'user_id' },
  { table: 'filter_presets', column: 'user_id' },
  { table: 'imports', column: 'user_id' },
  { table: 'shared_list_items', column: 'added_by' },
  // Either direction: a recommendation is one record belonging to both.
  { table: 'recommendations', column: 'from_user' },
  { table: 'recommendations', column: 'to_user' },
  // Both directions at once: the ids hold us both.
  { table: 'nudges', column: 'from_user' },
  { table: 'splash_lines', column: 'from_user' },
  { table: 'events', column: 'user_id' },
  { table: 'milestones', column: 'user_id' },
  { table: 'game_scores', column: 'user_id' },
  { table: 'game_record_notices', column: 'to_user' },
]

// Wheel items are keyed by wheel, so they go first, looked up through the
// wheels, and the wheels after them.
export const WHEEL_TABLES = ['custom_wheel_items', 'custom_wheels'] as const

// The truth or dare record, which the app itself can neither read nor delete.
export const CLEARED_BY_FUNCTION = ['td_turns', 'td_draws'] as const

// Columns set back to null on both profiles; the rows themselves stay.
// Nothing else: the old walkthrough column is kept in the database but unused.
export const PROFILE_FIELDS_RESET = ['reunion_date'] as const

/**
 * Never touched. films is the shared catalogue, profiles are what make the
 * two accounts a pair, td_cards is the game itself, and the accounts live
 * in auth.users.
 */
export const NEVER_CLEARED = ['films', 'profiles', 'td_cards', 'auth.users'] as const

// Every table Clear all data empties.
export function clearedTables(): string[] {
  return [
    ...new Set([
      ...ROW_DELETES.map((entry) => entry.table),
      ...WHEEL_TABLES,
      ...CLEARED_BY_FUNCTION,
    ]),
  ]
}
