import { supabase } from '../lib/supabaseClient'
import { DbError } from '../lib/dbError'
import type { Database } from '../types/supabase'
import { WARMUP_DECKS, shuffled } from './turnRules'
import type { Deck, Kind, Mode, Turn } from './turnRules'

// When this run of the app started. Closing the app ends an in-person
// session, so the warm-up counts only cards drawn since then.
export const APP_OPENED_AT = Date.now()

/**
 * Truth or dare against the database. A card only ever arrives through
 * draw_card; the cards table is not readable and nothing here asks it.
 */

type TurnRow = Database['public']['Tables']['td_turns']['Row']

export const PHOTO_BUCKET = 'truth-or-dare'
const SIGNED_URL_SECONDS = 60 * 60
const HISTORY_LIMIT = 200

const TURN_COLUMNS =
  'id, drawn_by, player, partner, mode, deck, kind, card_id, prompt, status, answer_text, answer_photo, answered_at, reaction, reacted_at, seen_at, created_at'

function toTurn(row: TurnRow): Turn {
  return {
    id: row.id,
    drawnBy: row.drawn_by,
    player: row.player,
    partner: row.partner,
    mode: row.mode,
    deck: row.deck,
    kind: row.kind,
    prompt: row.prompt,
    status: row.status,
    answerText: row.answer_text,
    answerPhoto: row.answer_photo,
    answeredAt: row.answered_at,
    reaction: row.reaction,
    reactedAt: row.reacted_at,
    seenAt: row.seen_at,
    createdAt: row.created_at,
  }
}

// Every turn between us, newest first.
export async function loadTurns(): Promise<Turn[]> {
  const { data, error } = await supabase
    .from('td_turns')
    .select(TURN_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)
  if (error) throw DbError.from(error)
  return (data ?? []).map(toTurn)
}

// How many of their turns are waiting for me to see. Never the turns.
export async function countWaitingForMe(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('td_turns')
    .select('id', { count: 'exact', head: true })
    .eq('partner', userId)
    .eq('mode', 'virtual')
    .neq('status', 'open')
    .is('seen_at', null)
  if (error) throw DbError.from(error)
  return count ?? 0
}

// A new turn, or null when that deck and kind have run out for me.
// deck null: the database picks one at random among those with a card
// left for me. The app never chooses one.
export async function drawCard(
  deck: Deck | null,
  kind: Kind,
  mode: Mode,
  player?: string,
): Promise<Turn | null> {
  const { data, error } = await supabase.rpc('draw_card', {
    p_deck: deck,
    p_kind: kind,
    p_mode: mode,
    ...(player ? { p_player: player } : {}),
  })
  if (error) throw DbError.from(error)
  const row = (data ?? [])[0]
  return row ? toTurn(row) : null
}

export async function answerTurn(
  turnId: string,
  text: string | null,
  photoPath: string | null,
): Promise<Turn> {
  const { data, error } = await supabase.rpc('answer_turn', {
    p_turn: turnId,
    p_text: text,
    p_photo: photoPath,
  })
  if (error) throw DbError.from(error)
  return toTurn(data)
}

export async function passTurn(turnId: string): Promise<Turn> {
  const { data, error } = await supabase.rpc('pass_turn', { p_turn: turnId })
  if (error) throw DbError.from(error)
  return toTurn(data)
}

export async function reactToTurn(turnId: string, reaction: string): Promise<Turn> {
  const { data, error } = await supabase.rpc('react_turn', {
    p_turn: turnId,
    p_reaction: reaction,
  })
  if (error) throw DbError.from(error)
  return toTurn(data)
}

export async function markSeen(turnIds: string[]): Promise<void> {
  if (turnIds.length === 0) return
  const { error } = await supabase.rpc('td_mark_seen', { p_turns: turnIds })
  if (error) throw DbError.from(error)
}

/**
 * A draw for this session. In the warm-up, spicy is left out: the other
 * three are tried in a random order until one has a card for me, which is
 * the same as the database's own random pick with spicy never in it.
 * After the warm-up, the database picks among all four.
 */
export async function drawForSession(
  kind: Kind,
  mode: Mode,
  player: string | undefined,
  warm: boolean,
): Promise<Turn | null> {
  if (!warm) return drawCard(null, kind, mode, player)
  for (const deck of shuffled(WARMUP_DECKS, Math.random)) {
    const turn = await drawCard(deck, kind, mode, player)
    if (turn) return turn
  }
  return null
}

// Reshuffles a kind for me alone: one deck, or with null, all four.
export async function resetDeck(deck: Deck | null, kind: Kind): Promise<number> {
  const { data, error } = await supabase.rpc('reset_deck', { p_deck: deck, p_kind: kind })
  if (error) throw DbError.from(error)
  return data ?? 0
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

const MAX_EDGE = 1600

// Phone photos are several megabytes; this keeps them to a few hundred
// kilobytes and drops whatever location data the original carried.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This device could not prepare the photo.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('This device could not prepare the photo.'))),
      'image/jpeg',
      0.85,
    ),
  )
}

// Into my own folder, which is the only one I can write to.
export async function uploadPhoto(userId: string, turnId: string, file: File): Promise<string> {
  const path = `${userId}/${turnId}-${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, await shrink(file), { contentType: 'image/jpeg', cacheControl: '3600' })
  if (error) throw new DbError(null, null, null, error.message)
  return path
}

export async function photoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) throw new DbError(null, null, null, error.message)
  return data.signedUrl
}
