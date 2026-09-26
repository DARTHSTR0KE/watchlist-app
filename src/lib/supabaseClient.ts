import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env')
}

/**
 * Every request gets a time limit. Without one, a request to a Supabase
 * that has stopped answering never settles, and whatever waits on it —
 * the first load after the splash, the wheel — waits forever. Cut off,
 * it fails like any other failure and the screen can say so.
 *
 * Uploads get longer: a photo on a slow connection is legitimately slow.
 */
const REQUEST_LIMIT_MS = 12_000
const UPLOAD_LIMIT_MS = 60_000

function fetchWithLimit(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const limit = url.includes('/storage/v1/') ? UPLOAD_LIMIT_MS : REQUEST_LIMIT_MS
  const controller = new AbortController()
  // A plain abort on purpose: the client never retries an AbortError, so
  // the limit is the limit. Any other error it retries three times over,
  // which turns twelve seconds into nearly a minute.
  const timer = window.setTimeout(() => controller.abort(), limit)
  // The caller's own cancel still works.
  const outer = init.signal
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason)
    else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    window.clearTimeout(timer),
  )
}

// Explicit persistSession + localStorage: the session must survive app
// restarts, not just live in memory for the current tab session.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: window.localStorage,
  },
  global: { fetch: fetchWithLimit },
})
