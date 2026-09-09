import { supabase } from '../lib/supabaseClient'

export interface MyProfile {
  displayName: string | null
  // Null means the walkthrough has never been finished or skipped.
  onboardedAt: string | null
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
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

export async function saveDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
  if (error) throw error
}
