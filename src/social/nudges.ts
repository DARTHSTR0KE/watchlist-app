import { supabase } from '../lib/supabaseClient'

/**
 * A short message that shows up at the top of the other person's app the
 * next time they open it. In-app only — no push, no permissions, nothing
 * to grant.
 *
 * One pending nudge at a time in each direction: sending a new one
 * replaces the old, so the row is keyed on who it is from. An unread
 * backlog of these would turn a nudge into a mailbox.
 */

export const NUDGE_MAX = 140

export interface Nudge {
  fromUser: string
  message: string
  createdAt: string | null
}

// The row is keyed on from_user, so an upsert replaces rather than stacks.
export async function sendNudge(userId: string, partnerId: string, message: string): Promise<void> {
  const text = message.trim().slice(0, NUDGE_MAX)
  if (text.length === 0) return
  const { error } = await supabase
    .from('nudges')
    .upsert(
      {
        from_user: userId,
        to_user: partnerId,
        message: text,
        dismissed: false,
        // Sent explicitly: the default only applies on insert, so a
        // replacement would otherwise keep the timestamp of the nudge it
        // replaced and read as days old the moment it arrived.
        created_at: new Date().toISOString(),
      },
      { onConflict: 'from_user' },
    )
  if (error) throw error
}

// What is waiting for me, if anything.
export async function loadNudge(userId: string): Promise<Nudge | null> {
  const { data, error } = await supabase
    .from('nudges')
    .select('from_user, message, created_at')
    .eq('to_user', userId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { fromUser: data.from_user, message: data.message, createdAt: data.created_at }
}

/**
 * Dismissing is the recipient's, and it is permanent for that nudge —
 * marking it rather than deleting it so the sender's own copy doesn't
 * vanish out from under them mid-edit.
 */
export async function dismissNudge(userId: string, fromUser: string): Promise<void> {
  const { error } = await supabase
    .from('nudges')
    .update({ dismissed: true })
    .eq('to_user', userId)
    .eq('from_user', fromUser)
  if (error) throw error
}
