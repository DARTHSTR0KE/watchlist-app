import { supabase } from '../lib/supabaseClient'
import type { Json } from '../types/supabase'
import { DEFAULT_FILTERS } from './filters'
import type { WheelFilters } from './filters'

export interface FilterPreset {
  id: string
  name: string
  filters: WheelFilters
}

export async function loadPresets(userId: string): Promise<FilterPreset[]> {
  const { data, error } = await supabase
    .from('filter_presets')
    .select('id, name, filters')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    // Stored as jsonb, so treat it as untrusted shape and fill any gaps
    // from the defaults rather than trusting every key to be present.
    filters: { ...DEFAULT_FILTERS, ...(row.filters as Partial<WheelFilters>) },
  }))
}

export async function savePreset(
  userId: string,
  name: string,
  filters: WheelFilters,
): Promise<FilterPreset> {
  const { data, error } = await supabase
    .from('filter_presets')
    .insert({ user_id: userId, name, filters: filters as unknown as Json })
    .select('id, name, filters')
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, filters }
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
