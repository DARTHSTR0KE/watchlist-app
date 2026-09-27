/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CLEARED_BY_FUNCTION,
  NEVER_CLEARED,
  PROFILE_FIELDS_RESET,
  ROW_DELETES,
  clearedTables,
} from './clearLists'

// What Clear all data was asked to wipe for both accounts, in the brief.
const REQUIRED = [
  'game_scores',
  'td_turns',
  'td_draws',
  'nudges',
  'splash_lines',
  'events',
  'milestones',
  'imports',
  'filter_presets',
  'spins',
  'watched',
  'watchlist_items',
  'recommendations',
  'shared_list_items',
  'custom_wheels',
  'custom_wheel_items',
]

// Wrapped gifts still wait on a storage policy before they can be cleared.
// Listed here so a new table can't slip past the check below unnoticed.
const NOT_YET_CLEARED = ['wrapped_gifts']

// The public tables the app knows about, from the generated types.
function typedTables(): string[] {
  const source = readFileSync(new URL('../types/supabase.ts', import.meta.url), 'utf8')
  const block = source.slice(source.indexOf('    Tables: {'), source.indexOf('    Views: {') >= 0
    ? source.indexOf('    Views: {')
    : source.indexOf('    Functions: {'))
  return [...block.matchAll(/^ {6}([a-z_]+): \{$/gm)].map((match) => match[1])
}

describe('Clear all data', () => {
  it('clears every table it was asked to, plus the record notices', () => {
    expect(clearedTables().sort()).toEqual([...REQUIRED, 'game_record_notices'].sort())
  })

  it('never clears anything it must not touch', () => {
    const cleared = new Set(clearedTables())
    for (const table of NEVER_CLEARED) expect(cleared.has(table)).toBe(false)
    expect(NEVER_CLEARED).toEqual(expect.arrayContaining(['films', 'profiles', 'td_cards', 'auth.users']))
  })

  it('resets the onboarding and reunion date on the profiles it keeps', () => {
    expect([...PROFILE_FIELDS_RESET].sort()).toEqual(['onboarded_at', 'reunion_date'])
  })

  it('leaves the seen-card record to the function, since the app cannot touch it', () => {
    expect(CLEARED_BY_FUNCTION).toContain('td_draws')
    expect(ROW_DELETES.map((entry) => entry.table)).not.toContain('td_draws')
  })

  it('clears recommendations in both directions', () => {
    const columns = ROW_DELETES.filter((entry) => entry.table === 'recommendations').map((entry) => entry.column)
    expect(columns.sort()).toEqual(['from_user', 'to_user'])
  })

  it('accounts for every table the app has, one way or the other', () => {
    const known = new Set([...clearedTables(), ...NEVER_CLEARED, ...NOT_YET_CLEARED])
    const tables = typedTables()
    expect(tables.length).toBeGreaterThan(10)
    expect(tables.filter((table) => !known.has(table))).toEqual([])
  })
})
