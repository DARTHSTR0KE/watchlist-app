// Recharts needs real colour values, not var() references, so the tokens
// are read back off the document rather than written down a second time.
// They don't change at runtime, so one read is enough.
let cache: Record<string, string> | null = null

export function palette(): Record<string, string> {
  if (cache) return cache
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string) => styles.getPropertyValue(name).trim()
  cache = {
    me: read('--me'),
    them: read('--them'),
    axis: read('--text-muted'),
    label: read('--text-dim'),
    neutral: read('--text-faintest'),
    cat1: read('--cat-1'),
    cat2: read('--cat-2'),
    cat3: read('--cat-3'),
    cat4: read('--cat-4'),
    cat5: read('--cat-5'),
    cat6: read('--cat-6'),
  }
  return cache
}

// The order categorical charts run through. Six of them, so a chart of up
// to six bars never repeats a colour.
export function categoryColors(count: number): string[] {
  const p = palette()
  const cycle = [p.cat1, p.cat2, p.cat3, p.cat4, p.cat5, p.cat6]
  return Array.from({ length: count }, (_, i) => cycle[i % cycle.length])
}

// Fixed for the two of us wherever we appear beside each other.
export function personColor(who: 'me' | 'them' | 'neither'): string {
  const p = palette()
  if (who === 'me') return p.me
  if (who === 'them') return p.them
  return p.neutral
}
