import { supabase } from '../lib/supabaseClient'
import type { Json } from '../types/supabase'
import { DEFAULT_FILTERS } from './filters'
import type { WheelFilters } from './filters'

export interface FilterPreset {
  id: string
  name: string
  filters: WheelFilters
  // Null when unstarred. Chips are ordered by this ascending, so a starred
  // preset holds its position as others come and go.
  starredAt: string | null
  createdAt: string | null
}

// How many presets can be starred onto the chip row at once.
export const MAX_STARRED_PRESETS = 3

function toPreset(row: {
  id: string
  name: string
  filters: Json
  starred_at: string | null
  created_at: string | null
}): FilterPreset {
  return {
    id: row.id,
    name: row.name,
    // Stored as jsonb, so treat it as untrusted shape and fill any gaps
    // from the defaults rather than trusting every key to be present.
    filters: { ...DEFAULT_FILTERS, ...(row.filters as Partial<WheelFilters>) },
    starredAt: row.starred_at,
    createdAt: row.created_at,
  }
}

// Newest first, which is the order the presets screen lists them in. The
// chip row re-sorts by starredAt itself.
export async function loadPresets(userId: string): Promise<FilterPreset[]> {
  const { data, error } = await supabase
    .from('filter_presets')
    .select('id, name, filters, starred_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toPreset)
}

export async function savePreset(
  userId: string,
  name: string,
  filters: WheelFilters,
): Promise<FilterPreset> {
  const { data, error } = await supabase
    .from('filter_presets')
    .insert({ user_id: userId, name, filters: filters as unknown as Json })
    .select('id, name, filters, starred_at, created_at')
    .single()
  if (error) throw error
  return toPreset(data)
}

export async function renamePreset(presetId: string, name: string): Promise<void> {
  const { error } = await supabase.from('filter_presets').update({ name }).eq('id', presetId)
  if (error) throw error
}

// Starring stamps the time; unstarring clears it. Nothing is unstarred
// automatically to make room — the caller enforces the cap.
export async function setPresetStarred(presetId: string, starred: boolean): Promise<string | null> {
  const starredAt = starred ? new Date().toISOString() : null
  // Read the stored value back so the ordering key is formatted exactly like
  // the ones loadPresets returns — the chips are sorted by comparing them.
  const { data, error } = await supabase
    .from('filter_presets')
    .update({ starred_at: starredAt })
    .eq('id', presetId)
    .select('starred_at')
    .single()
  if (error) throw error
  return data.starred_at
}

export async function deletePreset(presetId: string): Promise<void> {
  const { error } = await supabase.from('filter_presets').delete().eq('id', presetId)
  if (error) throw error
}

// Undo re-inserts the row as it was, id included, so a restored preset
// keeps its place in both the list and the chip row.
export async function restorePreset(userId: string, preset: FilterPreset): Promise<void> {
  const { error } = await supabase.from('filter_presets').insert({
    id: preset.id,
    user_id: userId,
    name: preset.name,
    filters: preset.filters as unknown as Json,
    starred_at: preset.starredAt,
    created_at: preset.createdAt,
  })
  if (error) throw error
}

export type SpinOutcome = 'watched' | 'rerolled' | 'removed' | 'abandoned'

// Logged when a spin lands, with the filters that produced it; the outcome
// lands later, once the result is acted on.
export async function recordSpin(
  userId: string,
  filmId: string | null,
  filters: WheelFilters,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('spins')
    .insert({ user_id: userId, film_id: filmId, filters: filters as unknown as Json })
    .select('id')
    .single()
  if (error) return null
  return data.id
}

export async function recordSpinOutcome(spinId: string, outcome: SpinOutcome): Promise<void> {
  await supabase.from('spins').update({ outcome }).eq('id', spinId)
}
