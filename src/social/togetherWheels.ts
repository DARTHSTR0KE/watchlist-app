import { supabase } from '../lib/supabaseClient'
import { subjectName } from '../utils/names'
import { FILM_COLUMNS, toWheelItemFromFilm } from '../wheel/loadWheelItems'
import type { WheelItem } from '../wheel/titles'
import { WHEEL_DRAW_SIZE, weightedSample } from '../wheel/weightedDraw'
import type { TogetherMode } from '../wheel/filters'
import { loadSharedListItems } from './sharedList'

export type { TogetherMode } from '../wheel/filters'

export interface TogetherWheel {
  items: WheelItem[]
  // Set when Mix couldn't take an even half from each, so the screen can
  // say so rather than quietly handing over a lopsided wheel.
  note: string | null
}

// Half each, when there is a half each to take.
const HALF = WHEEL_DRAW_SIZE / 2

async function loadWatchlistOf(userId: string): Promise<WheelItem[]> {
  const { data, error } = await supabase
    .from('watchlist_items')
    .select(`film_id, added_at, films(${FILM_COLUMNS})`)
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? [])
    .filter((row) => row.films !== null)
    .map((row) => toWheelItemFromFilm(row.film_id, row.films as never, { addedAt: row.added_at }))
}

/**
 * Four ways to build a wheel the two of us can sit down to. Each returns a
 * wheel ready to spin — picking one is the whole interaction, not a mode
 * to select before navigating somewhere else.
 */
export async function buildTogetherWheel(
  mode: TogetherMode,
  userId: string,
  partnerId: string,
  partnerName: string | null,
): Promise<TogetherWheel> {
  if (mode === 'ours') {
    return { items: await loadSharedListItems(), note: null }
  }
  if (mode === 'theirs') {
    return { items: weightedSample(await loadWatchlistOf(partnerId), WHEEL_DRAW_SIZE), note: null }
  }

  // Mix: genuinely from both. Whoever has fewer than a half's worth gives
  // up their shortfall to the other rather than the wheel coming up short.
  const [mineAll, theirsAll] = await Promise.all([
    loadWatchlistOf(userId),
    loadWatchlistOf(partnerId),
  ])

  const mineTake = Math.min(HALF, mineAll.length)
  const theirsTake = Math.min(HALF, theirsAll.length)
  const shortfall = WHEEL_DRAW_SIZE - mineTake - theirsTake

  const mine = weightedSample(mineAll, mineTake + (theirsTake < HALF ? shortfall : 0))
  const chosen = new Set(mine.map((item) => item.id))
  const theirs = weightedSample(
    // Never the same film twice, whichever list it came from.
    theirsAll.filter((item) => !chosen.has(item.id)),
    theirsTake + (mineTake < HALF ? shortfall : 0),
  )

  // Alternated, not concatenated: the wheel keeps array order, so two
  // blocks would read as your half and their half rather than a mix.
  const items: WheelItem[] = []
  for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
    if (i < mine.length) items.push(mine[i])
    if (i < theirs.length) items.push(theirs[i])
  }
  let note: string | null = null
  if (mineAll.length < HALF && theirsAll.length >= HALF) {
    note = `You only had ${mineAll.length} to draw from, so more came from ${partnerName ?? 'theirs'}.`
  } else if (theirsAll.length < HALF && mineAll.length >= HALF) {
    note = `${subjectName(partnerName, true)} only had ${theirsAll.length} to draw from, so more came from yours.`
  } else if (items.length < WHEEL_DRAW_SIZE) {
    note = `Only ${items.length} between you — that's the whole wheel.`
  }

  return { items, note }
}
