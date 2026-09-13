import { supabase } from '../lib/supabaseClient'

/**
 * The intro lives in Supabase storage rather than in the build. A file
 * under public/ is copied into dist and deployed with the app, so it would
 * ship with every release and sit in git besides. Workbox does not
 * precache it — the default glob covers js, css, html and images, not
 * video — but it is still weight in the release for something most opens
 * never touch.
 */
export const INTRO_BUCKET = 'media'
export const INTRO_OBJECT = 'intro.mp4'

// A pure string builder — no request is made until the video element asks
// for it, and the project URL comes from the environment rather than being
// written down here.
export function introVideoUrl(): string {
  return supabase.storage.from(INTRO_BUCKET).getPublicUrl(INTRO_OBJECT).data.publicUrl
}
