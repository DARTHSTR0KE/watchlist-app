/**
 * What PostgREST actually said when a query failed. A friendly "couldn't
 * load that" tells neither of us whether the table is missing, a policy
 * refused the row, or a function doesn't exist — and those need completely
 * different fixes. So the code, message and hint travel with the error
 * all the way to the screen.
 */
export class DbError extends Error {
  code: string | null
  detail: string | null
  hint: string | null

  constructor(code: string | null, detail: string | null, hint: string | null, message: string) {
    super(message)
    this.name = 'DbError'
    this.code = code
    this.detail = detail
    this.hint = hint
  }

  // Wraps whatever supabase-js handed back, which isn't always an Error.
  static from(error: {
    code?: string | null
    details?: string | null
    hint?: string | null
    message?: string
  }): DbError {
    return new DbError(
      error.code ?? null,
      error.details ?? null,
      error.hint ?? null,
      error.message ?? 'Unknown database error.',
    )
  }

  // What to put on screen: the code is the part that identifies the cause.
  get report(): string {
    const parts = [this.message]
    if (this.code) parts.push(`(${this.code})`)
    if (this.hint) parts.push(`Hint: ${this.hint}`)
    return parts.join(' ')
  }
}

/**
 * The reason, for any failure: a DbError's report, an Error's message, or
 * a PostgREST error object that was thrown as it came.
 */
export function describeError(error: unknown): string {
  if (error instanceof DbError) return error.report
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const shaped = error as { code?: string; message?: string; hint?: string; details?: string }
    if (shaped.code !== undefined || shaped.hint !== undefined) return DbError.from(shaped).report
    if (typeof shaped.message === 'string') return shaped.message
  }
  return 'Unknown error.'
}

/**
 * Failures that are deliberately kept off the screen — the event log, the
 * milestones, the splash's own fetch — still get kept, so Settings can say
 * what went wrong in the background. Only the latest; this is a clue, not
 * a log.
 */
export interface QuietFailure {
  where: string
  report: string
  at: string
}

let lastQuiet: QuietFailure | null = null
const quietListeners = new Set<() => void>()

export function reportQuietly(where: string, error: unknown): void {
  const report = describeError(error)
  lastQuiet = { where, report, at: new Date().toISOString() }
  console.warn(`[${where}]`, report)
  for (const listener of quietListeners) listener()
}

export function lastQuietFailure(): QuietFailure | null {
  return lastQuiet
}

export function subscribeQuietFailures(listener: () => void): () => void {
  quietListeners.add(listener)
  return () => quietListeners.delete(listener)
}
