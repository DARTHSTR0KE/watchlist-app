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
