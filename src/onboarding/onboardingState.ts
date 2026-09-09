import { supabase } from '../lib/supabaseClient'

export interface MyProfile {
  displayName: string | null
  // Null means the walkthrough has never been finished or skipped.
  onboardedAt: string | null
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

// Against the user id rather than this device, so signing in on a phone
// after a laptop doesn't start the walkthrough again.
export async function loadMyProfile(userId: string): Promise<MyProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, onboarded_at')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { displayName: data.display_name, onboardedAt: data.onboarded_at }
}

// Skipping counts as done: being asked again after saying no is worse than
// never asking. "Replay walkthrough" in settings is the way back in.
export async function markOnboarded(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')
  if (error) throw error
  // Without this the walkthrough silently returns on every open.
  if (!data || data.length === 0) throw new NoRowsAffected('Recording the walkthrough')
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
