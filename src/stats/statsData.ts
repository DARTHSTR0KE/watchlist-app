import { supabase } from '../lib/supabaseClient'
import type { CreditPerson } from '../lib/filmCredits'
import { loadTogetherFilmIds } from '../social/pendingWatches'
import type { FilmFacts, StatsRaw, WatchedRecord } from './statsCompute'

/**
 * The raw rows behind the stats page. Reducing them happens in
 * statsCompute, which never touches the network.
 */

interface FilmJoin {
  title: string
  runtime: number | null
  genres: string[] | null
  original_language: string | null
  media_type: 'movie' | 'tv'
  poster_path: string | null
  top_cast: unknown
  directors: unknown
  countries: string[] | null
}

interface WatchedJoinRow {
  film_id: string
  rating: number | null
  watched_on: string | null
  together: boolean | null
  films: FilmJoin | null
}

const WATCHED_COLUMNS =
  'film_id, rating, watched_on, together, films(title, runtime, genres, original_language, media_type, poster_path, top_cast, directors, countries)'

// jsonb arrives unknown-shaped. Anything that isn't a list of named people
// reads as never fetched, which is what it effectively is.
function toPeople(value: unknown): CreditPerson[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter(
      (entry): entry is { name: string; profile_path?: unknown } =>
        typeof entry === 'object' && entry !== null && typeof entry.name === 'string',
    )
    .map((entry) => ({
      name: entry.name,
      profile_path: typeof entry.profile_path === 'string' ? entry.profile_path : null,
    }))
}

function toFacts(film: FilmJoin): FilmFacts {
  return {
    title: film.title,
    runtime: film.runtime,
    genres: film.genres ?? [],
    originalLanguage: film.original_language,
    mediaType: film.media_type,
    posterPath: film.poster_path,
    topCast: toPeople(film.top_cast),
    directors: toPeople(film.directors),
    countries: film.countries,
  }
}

async function fetchWatched(userId: string): Promise<WatchedJoinRow[]> {
  const { data, error } = await supabase
    .from('watched')
    .select(WATCHED_COLUMNS)
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as unknown as WatchedJoinRow[]
}

function toRecord(row: WatchedJoinRow): WatchedRecord {
  return {
    filmId: row.film_id,
    rating: row.rating,
    watchedOn: row.watched_on,
    together: row.together,
  }
}

export async function loadStatsRaw(userId: string, partnerId: string | null): Promise<StatsRaw> {
  const [mineRows, theirRows, togetherFilmIds, spins] = await Promise.all([
    fetchWatched(userId),
    partnerId ? fetchWatched(partnerId) : Promise.resolve([] as WatchedJoinRow[]),
    loadTogetherFilmIds().catch(() => new Set<string>()),
    supabase.from('spins').select('film_id, outcome, created_at, films(title)').eq('user_id', userId),
  ])
  if (spins.error) throw spins.error

  const films = new Map<string, FilmFacts>()
  for (const row of [...mineRows, ...theirRows]) {
    if (row.films && !films.has(row.film_id)) films.set(row.film_id, toFacts(row.films))
  }

  // A dodged film is usually still on the list rather than watched, so its
  // title comes with the spin rather than from the watched rows.
  const spinRows = (spins.data ?? []) as unknown as {
    film_id: string | null
    outcome: string | null
    created_at: string | null
    films: { title: string } | null
  }[]
  const spinTitles = new Map<string, string>()
  for (const row of spinRows) {
    if (row.film_id && row.films) spinTitles.set(row.film_id, row.films.title)
  }

  return {
    togetherFilmIds,
    mine: mineRows.map(toRecord),
    theirs: theirRows.map(toRecord),
    films,
    spins: spinRows.map((row) => ({
      filmId: row.film_id,
      outcome: row.outcome,
      createdAt: row.created_at,
    })),
    spinTitles,
  }
}
