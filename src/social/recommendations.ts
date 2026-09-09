import { supabase } from '../lib/supabaseClient'

export interface Recommendation {
  id: string
  filmId: string
  title: string
  year: number | null
  posterPath: string | null
  note: string | null
  status: 'queued' | 'passed' | 'watched'
  seen: boolean
  createdAt: string | null
  // Null while it still needs a decision. This, rather than status, is what
  // marks one as dealt with — "added to my watchlist" leaves it queued,
  // since that is exactly what it then is.
  respondedAt: string | null
}

interface RecommendationRow {
  id: string
  film_id: string
  note: string | null
  status: 'queued' | 'passed' | 'watched'
  seen: boolean
  created_at: string | null
  responded_at: string | null
  films: { title: string; year: number | null; poster_path: string | null } | null
}

const ROW_COLUMNS =
  'id, film_id, note, status, seen, created_at, responded_at, films(title, year, poster_path)'

export async function loadRecommendationsForMe(userId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select(ROW_COLUMNS)
    .eq('to_user', userId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return toRecommendations(data)
}

function toRecommendations(data: unknown): Recommendation[] {
  return ((data ?? []) as RecommendationRow[])
    .filter((row) => row.films !== null)
    .map((row) => ({
      id: row.id,
      filmId: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
      note: row.note,
      status: row.status,
      seen: row.seen,
      createdAt: row.created_at,
      respondedAt: row.responded_at,
    }))
}

// Drives the nav badge: what has arrived but not yet been looked at.
export async function countUnseenRecommendations(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('to_user', userId)
    .eq('seen', false)
  if (error) throw error
  return count ?? 0
}

// Opening the screen is what counts as seeing them.
export async function markRecommendationsSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({ seen: true })
    .eq('to_user', userId)
    .eq('seen', false)
  if (error) throw error
}


// Sending never touches a watchlist: a recommendation is a suggestion,
// and whether it becomes something to watch is the recipient's call.
export async function sendRecommendation(
  fromUser: string,
  toUser: string,
  filmId: string,
  note: string,
): Promise<void> {
  const trimmed = note.trim()
  const { error } = await supabase.from('recommendations').insert({
    from_user: fromUser,
    to_user: toUser,
    film_id: filmId,
    note: trimmed.length > 0 ? trimmed : null,
  })
  if (error) throw error
}

// What this user has sent that the other person has not dealt with yet —
// responded_at, not status, is what marks one as answered.
export async function loadRecommendationsSent(userId: string): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from('recommendations')
    .select(ROW_COLUMNS)
    .eq('from_user', userId)
    .is('responded_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return toRecommendations(data)
}

// Records the decision. Status carries which way it went; responded_at is
// what takes it out of the pending list.
export async function respondToRecommendation(
  recommendationId: string,
  status: 'queued' | 'passed' | 'watched',
): Promise<void> {
  const { error } = await supabase
    .from('recommendations')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', recommendationId)
  if (error) throw error
}
