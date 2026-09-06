import Papa from 'papaparse'
import JSZip from 'jszip'

export interface LetterboxdRow {
  Date: string
  Name: string
  Year: string
  'Letterboxd URI': string
}

export interface LetterboxdRatingRow extends LetterboxdRow {
  Rating: string
}

export interface ParsedLetterboxdExport {
  watchlist: LetterboxdRow[]
  ratings: LetterboxdRatingRow[]
  watched: LetterboxdRow[]
}

const EXPECTED_FILES = ['watchlist', 'ratings', 'watched'] as const
type ExpectedFile = (typeof EXPECTED_FILES)[number]

function matchExpectedFile(filename: string): ExpectedFile | null {
  const base = filename.split('/').pop()?.toLowerCase() ?? ''
  const match = EXPECTED_FILES.find((name) => base === `${name}.csv`)
  return match ?? null
}

function parseCsv<T>(csvText: string): T[] {
  const result = Papa.parse<T>(csvText, { header: true, skipEmptyLines: true })
  return result.data
}

async function collectFileTexts(input: FileList | File[]): Promise<Partial<Record<ExpectedFile, string>>> {
  const files = Array.from(input)
  const texts: Partial<Record<ExpectedFile, string>> = {}

  // A single .zip: unzip and pull the three files out of it (wherever they
  // sit inside the archive — Letterboxd's export layout has varied).
  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(files[0])
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      const matched = matchExpectedFile(path)
      if (matched) texts[matched] = await entry.async('string')
    }
    return texts
  }

  // Otherwise: one or more loose CSV files, matched by filename.
  for (const file of files) {
    const matched = matchExpectedFile(file.name)
    if (matched) texts[matched] = await file.text()
  }
  return texts
}

export async function parseLetterboxdFiles(input: FileList | File[]): Promise<ParsedLetterboxdExport> {
  const texts = await collectFileTexts(input)

  if (!texts.watchlist && !texts.ratings && !texts.watched) {
    throw new Error(
      "Couldn't find watchlist.csv, ratings.csv, or watched.csv. Select your Letterboxd export .zip, or those CSV files directly.",
    )
  }

  return {
    watchlist: texts.watchlist ? parseCsv<LetterboxdRow>(texts.watchlist) : [],
    ratings: texts.ratings ? parseCsv<LetterboxdRatingRow>(texts.ratings) : [],
    watched: texts.watched ? parseCsv<LetterboxdRow>(texts.watched) : [],
  }
}
