import type { WatchlistCsvEntry } from './watchlistWrites'

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

// Letterboxd's own import format. Title and Year are what it matches on;
// LetterboxdURI makes the match exact when we have it from the export.
export function buildLetterboxdCsv(entries: WatchlistCsvEntry[]): string {
  const header = 'Title,Year,LetterboxdURI'
  const rows = entries.map((entry) =>
    [
      escapeCsvField(entry.title),
      entry.year === null ? '' : String(entry.year),
      escapeCsvField(entry.letterboxdUri ?? ''),
    ].join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function downloadLetterboxdCsv(entries: WatchlistCsvEntry[], filename: string): void {
  const blob = new Blob([buildLetterboxdCsv(entries)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
