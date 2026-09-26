import { isRainCode } from './ambient'
import type { Weather } from './ambient'

// Mumbai, fixed. Asking for location to change one line of text would be
// a permission prompt out of all proportion to what it buys.
const LATITUDE = 19.076
const LONGITUDE = 72.8777
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,precipitation,weather_code`

// Past this the splash has already said what it will say, so the answer
// is no use and the request is abandoned.
export const WEATHER_TIMEOUT_MS = 1200

let pending: Promise<Weather | null> | null = null

/**
 * One free call, no key, once per page load. Anything but a quick, clean
 * answer is null: slow, offline, blocked or malformed all read as "no
 * weather", and none of them is ever shown or waited on.
 */
export function loadWeather(): Promise<Weather | null> {
  if (pending) return pending
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS)
  pending = fetch(URL, { signal: controller.signal })
    .then((response) => (response.ok ? response.json() : null))
    .then((body: unknown) => {
      const current = (body as { current?: Record<string, unknown> } | null)?.current
      const temperature = current?.temperature_2m
      const precipitation = current?.precipitation
      const code = current?.weather_code
      if (typeof temperature !== 'number') return null
      const raining =
        (typeof precipitation === 'number' && precipitation > 0) ||
        (typeof code === 'number' && isRainCode(code))
      return { temperature, raining }
    })
    .catch(() => null)
    .finally(() => window.clearTimeout(timer))
  return pending
}
