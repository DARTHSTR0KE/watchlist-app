import { supabase } from '../lib/supabaseClient'
import { DbError } from '../lib/dbError'

/**
 * The facts the tickets at the top of each screen carry. The arithmetic is
 * kept apart from the queries so it can be tested without a database.
 */

// A date or timestamp's year, by its first four characters: watched_on is
// a plain date, and a timestamp's leading year is close enough for a count.
export function yearOf(value: string | null | undefined): number | null {
  if (!value) return null
  const year = Number.parseInt(value.slice(0, 4), 10)
  return Number.isNaN(year) ? null : year
}

/* ------------------------------------------------------------------ */
/* For me                                                              */
/* ------------------------------------------------------------------ */

export interface ReceivedFilm {
  filmId: string
  createdAt: string | null
  status: 'queued' | 'passed' | 'watched'
}

// What they sent me this year, and how many of those I have since watched
// — by the recommendation's own status or by it turning up in my watched.
export function forMeCounts(
  received: ReceivedFilm[],
  watchedIds: Set<string>,
  year: number,
): { sentThisYear: number; watchedOfThem: number } {
  const thisYear = received.filter((item) => yearOf(item.createdAt) === year)
  return {
    sentThisYear: thisYear.length,
    watchedOfThem: thisYear.filter((item) => item.status === 'watched' || watchedIds.has(item.filmId))
      .length,
  }
}

/* ------------------------------------------------------------------ */
/* Together                                                            */
/* ------------------------------------------------------------------ */

// Films watched together, counted by year, once per film at its latest
// sitting — either of our rows can say it, and a rewatch is one film.
export function togetherByYear(rows: { filmId: string; watchedOn: string | null }[]): Map<number, number> {
  const latest = new Map<string, string>()
  for (const row of rows) {
    if (!row.watchedOn) continue
    const existing = latest.get(row.filmId)
    if (!existing || row.watchedOn > existing) latest.set(row.filmId, row.watchedOn)
  }
  const counts = new Map<number, number>()
  for (const date of latest.values()) {
    const year = yearOf(date)
    if (year !== null) counts.set(year, (counts.get(year) ?? 0) + 1)
  }
  return counts
}

// The stub under Together: this year against last, in a few words.
export function comparedToLastYear(thisYear: number, lastYear: number): string {
  if (lastYear === 0) return thisYear === 0 ? 'NOTHING SIDE BY SIDE YET' : 'NONE LAST YEAR'
  if (thisYear === lastYear) return `THE SAME AS LAST YEAR`
  const difference = Math.abs(thisYear - lastYear)
  return `${difference} ${thisYear > lastYear ? 'MORE' : 'FEWER'} THAN LAST YEAR`
}

export async function loadTogetherWatched(): Promise<{ filmId: string; watchedOn: string | null }[]> {
  const { data, error } = await supabase.from('watched').select('film_id, watched_on').eq('together', true)
  if (error) throw DbError.from(error)
  return (data ?? []).map((row) => ({ filmId: row.film_id, watchedOn: row.watched_on }))
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function countMySpins(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('spins')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw DbError.from(error)
  return count ?? 0
}

// The poster of the last film I watched, for the Settings ground.
export async function loadLastWatchedPoster(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('watched')
    .select('watched_on, films(poster_path)')
    .eq('user_id', userId)
    .not('watched_on', 'is', null)
    .order('watched_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw DbError.from(error)
  return (data as unknown as { films: { poster_path: string | null } | null } | null)?.films?.poster_path ?? null
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
