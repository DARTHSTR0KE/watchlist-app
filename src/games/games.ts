import { supabase } from '../lib/supabaseClient'
import { DbError } from '../lib/dbError'
import { loadWatchedPicker, loadWatchlistPicker } from '../wheel/customWheels'
import { buildPosterUrl } from '../wheel/posters'
import { buildPool } from './gameRules'
import type { GameId, GamePool, GameScore, PosterFilm, RecordNotice } from './gameRules'

/**
 * The games against the database. Scores are only ever written by
 * submit_score, which also logs each game to events and leaves the other
 * of us a notice when a record of theirs falls.
 */

// Both watchlists for the safe posters, my watched films for the rest.
export async function loadGamePool(userId: string, partnerId: string | null): Promise<GamePool> {
  const [mine, theirs, watched] = await Promise.all([
    loadWatchlistPicker(userId),
    partnerId ? loadWatchlistPicker(partnerId) : Promise.resolve([]),
    loadWatchedPicker(userId),
  ])
  return buildPool(mine, theirs, watched)
}

// Fetched before play starts, so a poster never falls in blank.
export function preloadPosters(films: readonly PosterFilm[]): Promise<void> {
  return Promise.all(
    films.map(
      (film) =>
        new Promise<void>((resolve) => {
          const image = new Image()
          image.onload = () => resolve()
          image.onerror = () => resolve()
          image.src = buildPosterUrl(film.posterPath) ?? ''
        }),
    ),
  ).then(() => undefined)
}

export async function loadScores(): Promise<GameScore[]> {
  const { data, error } = await supabase
    .from('game_scores')
    .select('user_id, game, best_score, best_at, plays')
  if (error) throw DbError.from(error)
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    game: row.game,
    bestScore: row.best_score,
    bestAt: row.best_at,
    plays: row.plays,
  }))
}

export async function submitScore(
  game: GameId,
  score: number,
): Promise<{ best: number; beatTheirRecord: boolean }> {
  const { data, error } = await supabase.rpc('submit_score', { p_game: game, p_score: score })
  if (error) throw DbError.from(error)
  return { best: data.best, beatTheirRecord: data.beat_their_record }
}

// Mine, waiting to be told.
export async function loadRecordNotices(): Promise<RecordNotice[]> {
  const { data, error } = await supabase
    .from('game_record_notices')
    .select('id, game, score, previous_score, created_at')
    .eq('dismissed', false)
    .order('created_at', { ascending: true })
  if (error) throw DbError.from(error)
  return (data ?? []).map((row) => ({
    id: row.id,
    game: row.game,
    score: row.score,
    previousScore: row.previous_score,
    createdAt: row.created_at,
  }))
}

export async function dismissRecordNotices(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.rpc('dismiss_record_notices', { p_ids: ids })
  if (error) throw DbError.from(error)
}
