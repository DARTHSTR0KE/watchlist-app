import { languageLabel } from './filters'
import type { WheelFilters } from './filters'

// A one-line, readable description of what a preset filters — so a saved
// combination can be recognised in a list without applying it.
// e.g. "Films, under 100 min, Korean or Japanese"
export function describeFilters(filters: WheelFilters): string {
  const parts: string[] = []

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

  if (filters.excludeWatched) parts.push('unwatched only')

  return parts.length === 0 ? 'Everything' : parts.join(', ')
}
