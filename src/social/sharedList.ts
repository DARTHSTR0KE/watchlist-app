import { supabase } from '../lib/supabaseClient'
import { FILM_COLUMNS, toWheelItemFromFilm } from '../wheel/loadWheelItems'
import type { WheelItem } from '../wheel/titles'

export interface SharedListEntry {
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  addedBy: string
  addedAt: string | null
}

interface SharedRow {
  film_id: string
  added_by: string
  added_at: string | null
  films: { title: string; year: number | null; poster_path: string | null } | null
}

// One list, not one per person: film_id is unique on the table, so both of
// us are looking at the same rows.
export async function loadSharedList(): Promise<SharedListEntry[]> {
  const { data, error } = await supabase
    .from('shared_list_items')
    .select('film_id, added_by, added_at, films(title, year, poster_path)')
    .order('added_at', { ascending: false })
  if (error) throw error

  return ((data ?? []) as unknown as SharedRow[])
    .filter((row) => row.films !== null)
    .map((row) => ({
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      addedBy: row.added_by,
      addedAt: row.added_at,
    }))
}

export async function loadSharedListItems(): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('shared_list_items')
    .select(`film_id, added_at, films(${FILM_COLUMNS})`)
    .order('added_at', { ascending: false })
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.films !== null)
    .map((row) =>
      toWheelItemFromFilm(row.film_id, row.films as never, { addedAt: row.added_at }),
    )
}

export async function addToSharedList(userId: string, filmId: string): Promise<void> {
  const { error } = await supabase
    .from('shared_list_items')
    .insert({ film_id: filmId, added_by: userId })
  // film_id is unique, so adding what the other person already added is a
  // no-op rather than a failure.
  if (error && error.code !== '23505') throw error
}

// Keyed on the exact film_id and nothing broader. The policy on this table
// is `using (true)`, so there is no backstop if the filter is wrong.
export async function removeFromSharedList(filmId: string): Promise<void> {
  const { error } = await supabase.from('shared_list_items').delete().eq('film_id', filmId)
  if (error) throw error
}
