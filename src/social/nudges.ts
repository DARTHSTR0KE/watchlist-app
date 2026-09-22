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

/**
 * What the field will accept, and what the table's own check allows. It is
 * deliberately more than a nudge may be: typing past the real limit is how
 * the count and the disabled button get to explain themselves, where a
 * field that simply stopped would leave a pasted sentence silently short.
 */
export const NUDGE_MAX = 140

/**
 * What a nudge may actually be. Longer than this will not fit in a speech
 * bubble over an animal's head, and every nudge is spoken now.
 */
export const NUDGE_SPOKEN_MAX = 40

/**
 * Carries what PostgREST actually said. "That didn't send" told neither of
 * us whether the table was missing, a policy refused the row, or a foreign
 * key had nothing to point at — and those need completely different fixes.
 */
export class NudgeSendError extends Error {
  code: string | null
  detail: string | null
  hint: string | null

  constructor(code: string | null, detail: string | null, hint: string | null, message: string) {
    super(message)
    this.name = 'NudgeSendError'
    this.code = code
    this.detail = detail
    this.hint = hint
  }

  // What to put on screen: the code is the part that identifies the cause.
  get report(): string {
    const parts = [this.message]
    if (this.code) parts.push(`(${this.code})`)
    if (this.hint) parts.push(`Hint: ${this.hint}`)
    return parts.join(' ')
  }
}

export interface Nudge {
  fromUser: string
  message: string
  createdAt: string | null
  // Whether the sender asked for it to be spoken on the splash.
  onSplash: boolean
}

/**
 * The row is keyed on from_user, so an upsert replaces rather than stacks.
 *
 * Every nudge is spoken on the splash now, so there is nothing to pass:
 * the only thing that varies is whether the splash gets the chance to
 * speak it before the banner does, and that is nudgeDelivery's business,
 * not this function's.
 */
export async function sendNudge(userId: string, partnerId: string, message: string): Promise<void> {
  // Capped here as well as by the disabled button: the length that can be
  // read over an animal's head is a fact about the message, not about the
  // form that happened to submit it.
  const text = message.trim().slice(0, NUDGE_SPOKEN_MAX)
  if (text.length === 0) return
  if (!partnerId) {
    throw new NudgeSendError(null, null, null, 'There is no partner to send this to.')
  }
  const { error } = await supabase
    .from('nudges')
    .upsert(
      {
        from_user: userId,
        to_user: partnerId,
        message: text,
        dismissed: false,
        on_splash: true,
        // Sent explicitly: the default only applies on insert, so a
        // replacement would otherwise keep the timestamp of the nudge it
        // replaced and read as days old the moment it arrived.
        created_at: new Date().toISOString(),
      },
      { onConflict: 'from_user' },
    )
  if (error) {
    throw new NudgeSendError(error.code ?? null, error.details ?? null, error.hint ?? null, error.message)
  }
}

// What is waiting for me, if anything.
export async function loadNudge(userId: string): Promise<Nudge | null> {
  const { data, error } = await supabase
    .from('nudges')
    .select('from_user, message, created_at, on_splash')
    .eq('to_user', userId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    fromUser: data.from_user,
    message: data.message,
    createdAt: data.created_at,
    onSplash: data.on_splash === true,
  }
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
