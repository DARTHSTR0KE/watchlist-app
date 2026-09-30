import { supabase } from '../lib/supabaseClient'

/**
 * The master account is fixed in the database by its user id (is_master in
 * pair-admin.sql), never by a build flag or anything the app can change.
 * Any failure reads as "not the master": the debug section stays hidden
 * unless the database has said yes.
 */
export async function loadIsMaster(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_master')
  if (error) return false
  return data === true
}

export interface WalkthroughReset {
  // When the partner had finished it, or null if it was already reset.
  was: string | null
}

// The partner's walkthrough only. The database refuses anyone but the
// master, and never touches the master's own onboarded_at.
export async function resetPartnerWalkthrough(): Promise<WalkthroughReset> {
  const { data, error } = await supabase.rpc('reset_partner_walkthrough')
  if (error) throw error
  const result = (data ?? {}) as { was?: string | null }
  return { was: result.was ?? null }
}
