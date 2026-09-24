import { supabase } from '../lib/supabaseClient'
import { DbError, reportQuietly } from '../lib/dbError'

/**
 * What the result modal needs to know about a film to react to it: did
 * they send it to me, and how often have I turned it down. Read once when
 * the wheel opens; rerolls this session are added on top by the caller.
 */
export interface LandingFacts {
  recommended: Set<string>
  rerolled: Map<string, number>
}

export async function loadLandingFacts(userId: string): Promise<LandingFacts> {
  const [recommendations, rerolls] = await Promise.all([
    supabase.from('recommendations').select('film_id').eq('to_user', userId),
    supabase.from('spins').select('film_id').eq('user_id', userId).eq('outcome', 'rerolled'),
  ])
  const facts: LandingFacts = { recommended: new Set(), rerolled: new Map() }
  // Either half failing just means no reaction of that kind — the modal
  // is never held up for it — but the reason is kept.
  if (recommendations.error) {
    reportQuietly('Reading recommendations for the result', DbError.from(recommendations.error))
  } else {
    for (const row of recommendations.data ?? []) facts.recommended.add(row.film_id)
  }
  if (rerolls.error) {
    reportQuietly('Reading rerolls for the result', DbError.from(rerolls.error))
  } else {
    for (const row of rerolls.data ?? []) {
      if (row.film_id) facts.rerolled.set(row.film_id, (facts.rerolled.get(row.film_id) ?? 0) + 1)
    }
  }
  return facts
}
