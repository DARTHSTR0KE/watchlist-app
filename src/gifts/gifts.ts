import { supabase } from '../lib/supabaseClient'
import { DbError } from '../lib/dbError'

/**
 * Two things each of us leaves for the other's Wrapped: a song to play
 * behind it, and a message at the end.
 *
 * The bucket is private and every read is a signed URL. The policies are
 * what keep the other person's gift hidden until the 15th — this file
 * never even asks for it; the most it asks is gift_waiting, which answers
 * yes or no.
 */

export const GIFTS_BUCKET = 'gifts'
// Long enough to play a song or a minute of video through, short enough
// that a copied link stops working soon after.
const SIGNED_URL_SECONDS = 60 * 60

export interface MyGift {
  trackPath: string | null
  trackTitle: string | null
  trackAt: string | null
  messagePath: string | null
  // Set once the message is sent, and from then on it is locked.
  messageAt: string | null
}

export const NO_GIFT: MyGift = {
  trackPath: null,
  trackTitle: null,
  trackAt: null,
  messagePath: null,
  messageAt: null,
}

export function giftPath(userId: string, year: number, kind: 'track' | 'message'): string {
  return `${userId}/${year}/${kind}`
}

export function hasLeftAnything(gift: MyGift): boolean {
  return gift.trackPath !== null || gift.messageAt !== null
}

// What I have left for them this year. Nothing about what they left me.
export async function loadMyGift(userId: string, year: number): Promise<MyGift> {
  const { data, error } = await supabase
    .from('wrapped_gifts')
    .select('track_path, track_title, track_at, message_path, message_at')
    .eq('from_user', userId)
    .eq('year', year)
    .maybeSingle()
  if (error) throw DbError.from(error)
  if (!data) return NO_GIFT
  return {
    trackPath: data.track_path,
    trackTitle: data.track_title,
    trackAt: data.track_at,
    messagePath: data.message_path,
    messageAt: data.message_at,
  }
}

// Storage errors aren't PostgREST errors, but they carry a message and
// sometimes a status, which is what the screen needs.
function storageError(error: { message: string; statusCode?: string; name?: string }): DbError {
  return new DbError(error.statusCode ?? error.name ?? null, null, null, error.message)
}

async function upload(path: string, file: Blob, contentType: string): Promise<void> {
  const { error } = await supabase.storage
    .from(GIFTS_BUCKET)
    // upsert, so a replacement lands on the same path. The policies refuse
    // it after the 14th, and refuse a message once it has been sent.
    .upload(path, file, { upsert: true, contentType, cacheControl: '0' })
  if (error) throw storageError(error as { message: string; statusCode?: string })
}

// The file's own name, less its extension: what the song is called.
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const bare = dot > 0 ? name.slice(0, dot) : name
  return bare.trim() || 'Untitled'
}

export async function saveTrack(
  userId: string,
  partnerId: string,
  year: number,
  file: File,
): Promise<MyGift> {
  const path = giftPath(userId, year, 'track')
  await upload(path, file, file.type || 'audio/mpeg')
  const { data, error } = await supabase
    .from('wrapped_gifts')
    .upsert(
      {
        from_user: userId,
        to_user: partnerId,
        year,
        track_path: path,
        track_title: titleFromFileName(file.name),
        track_at: new Date().toISOString(),
      },
      { onConflict: 'from_user,year' },
    )
    .select('track_path, track_title, track_at, message_path, message_at')
    .single()
  if (error) throw DbError.from(error)
  return {
    trackPath: data.track_path,
    trackTitle: data.track_title,
    trackAt: data.track_at,
    messagePath: data.message_path,
    messageAt: data.message_at,
  }
}

/**
 * Sends the message, once. The row's message_at is what locks it: the
 * trigger refuses any later change to it, and the storage policy refuses
 * any later write to its file.
 */
export async function sendMessage(
  userId: string,
  partnerId: string,
  year: number,
  video: Blob,
): Promise<MyGift> {
  const path = giftPath(userId, year, 'message')
  await upload(path, video, video.type || 'video/webm')
  const { data, error } = await supabase
    .from('wrapped_gifts')
    .upsert(
      {
        from_user: userId,
        to_user: partnerId,
        year,
        message_path: path,
        message_at: new Date().toISOString(),
      },
      { onConflict: 'from_user,year' },
    )
    .select('track_path, track_title, track_at, message_path, message_at')
    .single()
  if (error) throw DbError.from(error)
  return {
    trackPath: data.track_path,
    trackTitle: data.track_title,
    trackAt: data.track_at,
    messagePath: data.message_path,
    messageAt: data.message_at,
  }
}

// Only ever for my own files; theirs are refused by policy before the 15th.
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(GIFTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS)
  if (error) throw storageError(error as { message: string; statusCode?: string })
  return data.signedUrl
}

// Whether they have left me anything this year. Yes or no, never what.
export async function giftWaiting(year: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('gift_waiting', { p_year: year })
  if (error) throw DbError.from(error)
  return data === true
}

/* ------------------------------------------------------------------ */
/* The prompt's record, on this device                                 */
/* ------------------------------------------------------------------ */

const PROMPTED_KEY = 'wrapped-gift-prompted'

// Which of the three prompt days have already been shown, per year.
export function promptShown(year: number, day: number): boolean {
  try {
    return (window.localStorage.getItem(PROMPTED_KEY) ?? '').split(',').includes(`${year}-${day}`)
  } catch {
    // Unreadable storage would ask on every open; three times is the
    // promise, so it asks none rather than too many.
    return true
  }
}

export function recordPromptShown(year: number, day: number): void {
  try {
    const current = (window.localStorage.getItem(PROMPTED_KEY) ?? '').split(',').filter(Boolean)
    // Only this year's are worth keeping.
    const kept = current.filter((entry) => entry.startsWith(`${year}-`))
    window.localStorage.setItem(PROMPTED_KEY, [...kept, `${year}-${day}`].join(','))
  } catch {
    // Nothing to do; at worst it asks once more.
  }
}
