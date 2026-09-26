/**
 * What the app notices, as plain decisions with the clock passed in. None
 * of this is announced: each answer only changes a drawing or adds a line,
 * and most of the time every answer is "nothing".
 */

/* ------------------------------------------------------------------ */
/* Time of day, from the device clock                                  */
/* ------------------------------------------------------------------ */

// Before seven the fish is still asleep in its bowl.
export function fishAsleep(now: Date): boolean {
  return now.getHours() < 7
}

// Past midnight and not yet light: the raccoon is up, with a moon.
export function raccoonUpLate(now: Date): boolean {
  return now.getHours() < 5
}

// Between two and four: the hour itself gets acknowledged.
export function smallHours(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 2 && hour < 4
}

export function sundayMorning(now: Date): boolean {
  const hour = now.getHours()
  return now.getDay() === 0 && hour >= 6 && hour < 12
}

// Night, for what a film means at this hour.
export function isNight(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 21 || hour < 5
}

// After ten, for a long film: late enough that three hours is a decision.
export function isLate(now: Date): boolean {
  const hour = now.getHours()
  return hour >= 22 || hour < 4
}

/* ------------------------------------------------------------------ */
/* How long it's been                                                  */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000
export const AWAY_DAYS = 14
export const TIRED_OPENS = 4

// From last_open_at as it was before this open stamped over it.
export function awayLong(previousOpenAt: string | null | undefined, now: Date): boolean {
  if (!previousOpenAt) return false
  const then = new Date(previousOpenAt).getTime()
  if (Number.isNaN(then)) return false
  return now.getTime() - then > AWAY_DAYS * DAY_MS
}

// opensBefore is today's app_open events before this one, so this one
// is opensBefore + 1.
export function tiredFish(opensBefore: number | null): boolean {
  return opensBefore !== null && opensBefore + 1 >= TIRED_OPENS
}

/* ------------------------------------------------------------------ */
/* Both of you at once                                                 */
/* ------------------------------------------------------------------ */

export const TOGETHER_WINDOW_MS = 90 * 1000

// Their cold start and mine within ninety seconds of each other. Only the
// second of us can see it, which keeps it rare.
export function openedTogether(partnerLastOpenAt: string | null, now: Date): boolean {
  if (!partnerLastOpenAt) return false
  const then = new Date(partnerLastOpenAt).getTime()
  if (Number.isNaN(then)) return false
  return Math.abs(now.getTime() - then) <= TOGETHER_WINDOW_MS
}

/* ------------------------------------------------------------------ */
/* Weather                                                             */
/* ------------------------------------------------------------------ */

export interface Weather {
  temperature: number
  raining: boolean
}

export const HOT_ABOVE = 35

// WMO codes that mean something is falling: drizzle, rain, showers,
// thunderstorms.
export function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
}

/* ------------------------------------------------------------------ */
/* The splash's second line                                            */
/* ------------------------------------------------------------------ */

export interface SplashSignals {
  now: Date
  together: boolean
  weather: Weather | null
  away: boolean
}

/**
 * At most one line under the tagline, and usually none. The tagline is
 * theirs to write, so this never replaces it — it sits beneath.
 *
 * The order is rarity: seeing each other open it is rarest, the hour next,
 * then the weather, then Sunday.
 */
export function splashAside(signals: SplashSignals): string | null {
  const { now } = signals
  if (signals.together) return 'Oh. Hello, both of you.'
  if (smallHours(now)) {
    return now.getHours() === 2 ? "It's gone two." : 'Three in the morning. Of course.'
  }
  if (signals.away) return 'The wheel got dusty.'
  if (signals.weather?.raining) return 'Raining in Mumbai. Stay in.'
  if (signals.weather && signals.weather.temperature > HOT_ABOVE) {
    return `${Math.round(signals.weather.temperature)}° out there. Stay in.`
  }
  if (sundayMorning(now)) return 'Sunday morning. No rush.'
  return null
}

/* ------------------------------------------------------------------ */
/* The result modal                                                    */
/* ------------------------------------------------------------------ */

export type Reaction = 'flip' | 'back' | 'hide' | 'eyebrow'

export const DODGED_TIMES = 4
export const LONG_MINUTES = 180

export interface LandedFilm {
  // They sent it to me.
  recommendedByPartner: boolean
  // Times I have rerolled away from it, this session included.
  rerolledAway: number
  runtimeMinutes: number | null
  genres: string[]
}

/**
 * Most films get nothing. A reaction is kept for the few that earn one,
 * or it stops meaning anything.
 */
export function reactionFor(film: LandedFilm, now: Date): Reaction | null {
  if (film.recommendedByPartner) return 'flip'
  if (film.rerolledAway >= DODGED_TIMES) return 'back'
  if (isNight(now) && film.genres.includes('Horror')) return 'hide'
  if (isLate(now) && (film.runtimeMinutes ?? 0) > LONG_MINUTES) return 'eyebrow'
  return null
}

/* ------------------------------------------------------------------ */
/* Tapping                                                             */
/* ------------------------------------------------------------------ */

export const ESCALATE_AT = 4

// A tap or two is a small reaction; keep going and it becomes a bigger one.
export function tapLevel(tapsInBurst: number): 0 | 1 | 2 {
  if (tapsInBurst <= 0) return 0
  return tapsInBurst >= ESCALATE_AT ? 2 : 1
}
