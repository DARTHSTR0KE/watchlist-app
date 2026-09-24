// Recharts needs real colour values, not var() references, so the tokens
// are read back off the document rather than written down a second time.
// They don't change at runtime, so one read is enough.
let cache: Record<string, string> | null = null

export function palette(): Record<string, string> {
  if (cache) return cache
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => styles.getPropertyValue(name).trim()
  cache = {
    axis: read('--text-muted'),
    label: read('--text-dim'),
    amber: read('--amber'),
    rust: read('--rust'),
    sage: read('--sage'),
    slate: read('--slate'),
    mauve: read('--mauve'),
  }
  return cache
}

/**
 * What a section's colour means, the same as in the filter sheet: amber is
 * me, rust is them and anything negative, sage is shared and loved, slate
 * is places, mauve is genre.
 */
export type Tone = 'amber' | 'rust' | 'sage' | 'slate' | 'mauve'

export function toneColor(tone: Tone): string {
  return palette()[tone]
}
