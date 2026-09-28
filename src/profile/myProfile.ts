import { supabase } from '../lib/supabaseClient'
import { parseMascot } from '../brand/mascots'
import type { Mascot } from '../brand/mascots'

export interface MyProfile {
  displayName: string | null
  // Mine, for anywhere the app refers to me rather than to them.
  mascot: Mascot | null
}

/**
 * A PATCH that matches no rows is not an error in PostgREST — it succeeds
 * having done nothing. Every write here asks for the changed rows back and
 * treats an empty result as a failure, because "saved" that saved nothing
 * is the worst of both.
 */
export class NoRowsAffected extends Error {
  constructor(what: string) {
    super(`${what} matched no row. The profile row may be missing, or a policy may forbid the write.`)
    this.name = 'NoRowsAffected'
  }
}

// My own profile row: the name and animal the app refers to me by.
export async function loadMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, mascot')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    displayName: data.display_name,
    mascot: parseMascot(data.mascot),
  }
}

export async function saveDisplayName(userId: string, displayName: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new NoRowsAffected('Saving your name')
}
