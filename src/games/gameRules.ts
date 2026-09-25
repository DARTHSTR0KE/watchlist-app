/**
 * The two games' rules as plain decisions: difficulty, the record, the
 * shuffle, and which posters are in play. Nothing here touches Supabase or
 * the screen, so it can be tested as is.
 */

export type GameId = 'catch' | 'bait'

export const GAMES: { id: GameId; name: string; who: string }[] = [
  { id: 'catch', name: 'Catch', who: 'the raccoon' },
  { id: 'bait', name: 'The bait', who: 'the goldfish' },
]

export function gameName(game: GameId): string {
  return GAMES.find((entry) => entry.id === game)?.name ?? game
}

export const LIVES = 3

export interface PosterFilm {
  id: string
  title: string
  posterPath: string
}

/* ------------------------------------------------------------------ */
/* Which posters                                                       */
/* ------------------------------------------------------------------ */

export interface GamePool {
  // From either watchlist, and not something I have watched.
  safe: PosterFilm[]
  // From my own watched table: the ones that cost a life.
  watched: PosterFilm[]
}

type Listed = { id: string; title: string; posterPath: string | null }

// Only films with a poster: a game played at speed can't use a title card.
export function buildPool(
  myWatchlist: readonly Listed[],
  theirWatchlist: readonly Listed[],
  myWatched: readonly Listed[],
): GamePool {
  const withPoster = (film: Listed): film is PosterFilm => film.posterPath !== null
  const watched = new Map<string, PosterFilm>()
  for (const film of myWatched.filter(withPoster)) watched.set(film.id, film)
  const safe = new Map<string, PosterFilm>()
  for (const film of [...myWatchlist, ...theirWatchlist].filter(withPoster)) {
    if (!watched.has(film.id)) safe.set(film.id, film)
  }
  return { safe: [...safe.values()], watched: [...watched.values()] }
}

// Enough of each for the game to mean anything. Below this, the screen
// points at the import instead of starting a game that can't be lost or
// can't be scored.
export const MIN_SAFE = 6
export const MIN_WATCHED = 3

export function poolReady(pool: GamePool): boolean {
  return pool.safe.length >= MIN_SAFE && pool.watched.length >= MIN_WATCHED
}

// n distinct films, as far as the list allows.
export function sample<T>(list: readonly T[], n: number, random: () => number): T[] {
  const copy = [...list]
  const out: T[] = []
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0])
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Catch                                                               */
/* ------------------------------------------------------------------ */

// A little quicker for every poster caught, up to a ceiling.
export function catchSpawnMs(score: number): number {
  return Math.max(420, 1150 - score * 22)
}

// In field heights per second, so a taller phone isn't an easier game.
export function catchFallRate(score: number): number {
  return 0.28 + Math.min(score, 60) * 0.012
}

// How often a falling poster is one I have watched.
export function catchWatchedChance(score: number): number {
  return 0.3 + Math.min(score, 40) * 0.004
}

// The most posters in the air at once. Kept low so the frame rate holds.
export const CATCH_MAX_FALLING = 6

/* ------------------------------------------------------------------ */
/* The bait                                                            */
/* ------------------------------------------------------------------ */

export interface BaitRound {
  posters: number
  hooks: number
  lookMs: number
  swapMs: number
  swaps: number
}

// Four things harden as the chain grows: more posters, more hooks, a
// shorter look and a faster shuffle. The shuffle also gets longer.
export function baitRound(chain: number): BaitRound {
  const posters = Math.min(6, 3 + Math.floor(chain / 2))
  return {
    posters,
    hooks: Math.min(posters - 1, 1 + Math.floor(chain / 3)),
    lookMs: Math.max(700, 2200 - chain * 120),
    swapMs: Math.max(170, 520 - chain * 30),
    swaps: Math.min(12, 3 + chain),
  }
}

// Pairs of positions to swap, one after another. Never a position with
// itself, and never the same pair twice running, which would look like
// nothing happened.
export function shufflePlan(slots: number, swaps: number, random: () => number): [number, number][] {
  const plan: [number, number][] = []
  while (plan.length < swaps) {
    const a = Math.floor(random() * slots)
    let b = Math.floor(random() * (slots - 1))
    if (b >= a) b += 1
    const pair: [number, number] = a < b ? [a, b] : [b, a]
    const last = plan[plan.length - 1]
    if (last && last[0] === pair[0] && last[1] === pair[1]) continue
    plan.push(pair)
  }
  return plan
}

// Where each card sits after the swaps: order[slot] = card.
export function applyShuffle(cards: number, plan: readonly [number, number][]): number[] {
  const order = Array.from({ length: cards }, (_, index) => index)
  for (const [a, b] of plan) [order[a], order[b]] = [order[b], order[a]]
  return order
}

/* ------------------------------------------------------------------ */
/* The record between us                                               */
/* ------------------------------------------------------------------ */

export interface GameScore {
  userId: string
  game: GameId
  bestScore: number
  bestAt: string | null
  plays: number
}

export interface GameRecord {
  score: number
  holder: string
  at: string
}

// The higher of our two bests; on a tie, whoever set it first. The same
// rule submit_score uses to decide whether a record was beaten.
export function recordFor(scores: readonly GameScore[], game: GameId): GameRecord | null {
  let best: GameRecord | null = null
  for (const row of scores) {
    if (row.game !== game || row.bestAt === null) continue
    if (
      best === null ||
      row.bestScore > best.score ||
      (row.bestScore === best.score && row.bestAt < best.at)
    ) {
      best = { score: row.bestScore, holder: row.userId, at: row.bestAt }
    }
  }
  return best
}

/* ------------------------------------------------------------------ */
/* "Your record was beaten"                                            */
/* ------------------------------------------------------------------ */

export interface RecordNotice {
  id: number
  game: GameId
  score: number
  previousScore: number
  createdAt: string
}

// What follows their name in the banner. One line, however many waited:
// the newest per game, both games named together if both went.
export function noticeLine(notices: readonly RecordNotice[]): string | null {
  if (notices.length === 0) return null
  const latest = new Map<GameId, RecordNotice>()
  for (const notice of [...notices].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    latest.set(notice.game, notice)
  }
  const games = [...latest.values()]
  if (games.length === 1) {
    const [only] = games
    return `beat your ${gameName(only.game)} record: ${only.score}, over your ${only.previousScore}.`
  }
  return `beat your records at ${games.map((notice) => `${gameName(notice.game)} (${notice.score})`).join(' and ')}.`
}
