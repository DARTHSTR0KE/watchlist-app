import { supabase } from '../lib/supabaseClient'
import { logEvent } from '../events/events'
import type { WheelItem } from './titles'
import { FILM_COLUMNS, toWheelItemFromFilm } from './loadWheelItems'

// A custom wheel is spun in full rather than sampled, so it has to stay
// small enough to read as segments.
export const CUSTOM_WHEEL_MAX = 12

export interface CustomWheel {
  id: string
  name: string
  shared: boolean
  ownerId: string
  // Someone else's shared wheel can be spun but not edited.
  isMine: boolean
  filmCount: number
  // A few posters to show what is on it, without opening it.
  posterPaths: string[]
  createdAt: string | null
}

// Enough to read a row at a glance; more would be a wall of thumbnails.
export const WHEEL_PREVIEW_POSTERS = 3

interface WheelRow {
  id: string
  user_id: string
  name: string
  shared: boolean
  created_at: string | null
  custom_wheel_items: { count: number }[] | null
  // A second embed of the same relation: the count aggregate can't also
  // return rows, so the posters come alongside it.
  items: { films: { poster_path: string | null } | null }[] | null
}

const WHEEL_COLUMNS =
  'id, user_id, name, shared, created_at, custom_wheel_items(count), items:custom_wheel_items(films(poster_path))'

function toWheel(row: WheelRow, userId: string): CustomWheel {
  return {
    id: row.id,
    name: row.name,
    shared: row.shared,
    ownerId: row.user_id,
    isMine: row.user_id === userId,
    filmCount: row.custom_wheel_items?.[0]?.count ?? 0,
    posterPaths: (row.items ?? [])
      .map((item) => item.films?.poster_path ?? null)
      .filter((path): path is string => path !== null)
      .slice(0, WHEEL_PREVIEW_POSTERS),
    createdAt: row.created_at,
  }
}

// This user's wheels, plus any of their partner's marked shared. Mine
// first, then theirs, each newest first.
export async function loadCustomWheels(
  userId: string,
  partnerId: string | null,
): Promise<CustomWheel[]> {
  const mine = await supabase
    .from('custom_wheels')
    .select(WHEEL_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (mine.error) throw mine.error

  let shared: WheelRow[] = []
  if (partnerId) {
    const theirs = await supabase
      .from('custom_wheels')
      .select(WHEEL_COLUMNS)
      .eq('user_id', partnerId)
      .eq('shared', true)
      .order('created_at', { ascending: false })
    if (theirs.error) throw theirs.error
    shared = (theirs.data ?? []) as unknown as WheelRow[]
  }

  return [...((mine.data ?? []) as unknown as WheelRow[]), ...shared].map((row) =>
    toWheel(row, userId),
  )
}

export async function createCustomWheel(userId: string, name: string): Promise<CustomWheel> {
  const { data, error } = await supabase
    .from('custom_wheels')
    .insert({ user_id: userId, name })
    .select('id, user_id, name, shared, created_at')
    .single()
  if (error) throw error
  logEvent('wheel_created', { detail: { wheel_id: data.id } })
  return toWheel({ ...data, custom_wheel_items: null, items: null }, userId)
}

export async function renameCustomWheel(wheelId: string, name: string): Promise<void> {
  const { error } = await supabase.from('custom_wheels').update({ name }).eq('id', wheelId)
  if (error) throw error
}

export async function setCustomWheelShared(wheelId: string, shared: boolean): Promise<void> {
  const { error } = await supabase.from('custom_wheels').update({ shared }).eq('id', wheelId)
  if (error) throw error
}

export async function deleteCustomWheel(wheelId: string): Promise<void> {
  const { error } = await supabase.from('custom_wheels').delete().eq('id', wheelId)
  if (error) throw error
}

// The films on a wheel, oldest addition first so the order is the order
// they were chosen in.
export async function loadCustomWheelItems(wheelId: string): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('custom_wheel_items')
    .select(`film_id, added_at, films(${FILM_COLUMNS})`)
    .eq('wheel_id', wheelId)
    .order('added_at', { ascending: true })
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.films !== null)
    .map((row) =>
      toWheelItemFromFilm(row.film_id, row.films as never, { addedAt: row.added_at }),
    )
}

export async function addFilmToWheel(wheelId: string, filmId: string): Promise<void> {
  const { error } = await supabase
    .from('custom_wheel_items')
    .insert({ wheel_id: wheelId, film_id: filmId })
  // Adding something already on the wheel is a no-op, not a failure.
  if (error && error.code !== '23505') throw error
}

// Permanent, unlike "Not tonight" — this edits the wheel itself.
export async function removeFilmFromWheel(wheelId: string, filmId: string): Promise<void> {
  const { error } = await supabase
    .from('custom_wheel_items')
    .delete()
    .eq('wheel_id', wheelId)
    .eq('film_id', filmId)
  if (error) throw error
}

export interface PickerFilm {
  id: string
  title: string
  year: number | null
  posterPath: string | null
}

function toPicker(rows: { film_id: string; films: { title: string; year: number | null; poster_path: string | null } | null }[]): PickerFilm[] {
  return rows
    .filter((row) => row.films !== null)
    .map((row) => ({
      id: row.film_id,
      title: row.films!.title,
      year: row.films!.year,
      posterPath: row.films!.poster_path,
    }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function loadWatchlistPicker(userId: string): Promise<PickerFilm[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select('film_id, films(title, year, poster_path)')
    .eq('user_id', userId)
  if (error) throw error
  return toPicker(data ?? [])
}

// This user's own history in full. Passed a partner id it returns only
// what the two of them watched together — the policy on watched keeps
// anything either watched alone private to that person.
// Every film either of us marked as watched together — the same set both
// of us see, rather than one person's half of it.
export async function loadTogetherPicker(): Promise<PickerFilm[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, films(title, year, poster_path)')
    .eq('together', true)
  if (error) throw error
  const seen = new Set<string>()
  return toPicker((data ?? []).filter((row) => (seen.has(row.film_id) ? false : seen.add(row.film_id))))
}

export async function loadWatchedPicker(userId: string): Promise<PickerFilm[]> {
  const { data, error } = await supabase
    .from('watched')
    .select('film_id, films(title, year, poster_path)')
    .eq('user_id', userId)
  if (error) throw error
  return toPicker(data ?? [])
}
