import { WATCHED_BEFORE_OPTIONS, isWatchedSource, languageLabel } from './filters'
import type { WheelFilters } from './filters'

// 4 rather than "4.0", but 4.5 keeps its half.
function stars(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function describeRating(filters: WheelFilters): string | null {
  switch (filters.ratingMode) {
    case 'any':
      return null
    case 'min':
      return `rated ${stars(filters.ratingValue)}+`
    case 'exact':
      return `rated exactly ${stars(filters.ratingValue)}`
    case 'unrated':
      return 'never rated'
  }
}

function describeRecency(months: number | null): string | null {
  if (months === null) return null
  const option = WATCHED_BEFORE_OPTIONS.find((entry) => entry.months === months)
  return `not seen in ${option ? option.label : `${months} months`}`
}

// A one-line, readable description of what a preset filters — so a saved
// combination can be recognised in a list without applying it.
// e.g. "Films, under 100 min, Korean or Japanese"
export function describeFilters(filters: WheelFilters): string {
  const parts: string[] = []

  // The source leads, since it changes what the rest of the line is about.
  if (filters.source === 'rewatch') parts.push('Watched again')
  else if (filters.source === 'both-loved') parts.push('Both loved it')

  if (filters.mediaType === 'movie') parts.push('Films')
  else if (filters.mediaType === 'tv') parts.push('Shows')

  if (filters.maxRuntime !== null) parts.push(`under ${filters.maxRuntime} min`)

  if (filters.languages.length > 0) {
    parts.push(filters.languages.map(languageLabel).join(' or '))
  }

  if (filters.genres.length > 0) parts.push(filters.genres.join(' or '))

  const { decadeFrom, decadeTo } = filters
  if (decadeFrom !== null && decadeTo !== null) {
    parts.push(decadeFrom === decadeTo ? `${decadeFrom}s` : `${decadeFrom}s to ${decadeTo}s`)
  } else if (decadeFrom !== null) {
    parts.push(`${decadeFrom}s onwards`)
  } else if (decadeTo !== null) {
    parts.push(`up to the ${decadeTo}s`)
  }

  if (filters.source === 'watchlist' && filters.excludeWatched) parts.push('unwatched only')

  if (filters.source === 'rewatch') {
    const rating = describeRating(filters)
    if (rating) parts.push(rating)
  }
  if (filters.source === 'both-loved') {
    parts.push(`both rated ${stars(filters.bothLovedThreshold)}+`)
  }
  if (isWatchedSource(filters.source)) {
    const recency = describeRecency(filters.watchedBeforeMonths)
    if (recency) parts.push(recency)
  }

  return parts.length === 0 ? 'Everything' : parts.join(', ')
}
