import type { WheelItem } from './titles'

export const WHEEL_DRAW_SIZE = 8

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44

// Longer on the list, likelier to come up: months waiting, plus one, so a
// title added today still has a chance rather than a weight of zero.
export function ageWeight(item: WheelItem, now = Date.now()): number {
  if (!item.addedAt) return 1
  const added = new Date(item.addedAt).getTime()
  if (Number.isNaN(added)) return 1
  const months = Math.floor(Math.max(0, now - added) / MS_PER_MONTH)
  return months + 1
}

// Weighted sample without replacement. Pools here are hundreds of titles
// and size is 8, so the straightforward cumulative-weight walk is fine.
export function weightedSample(
  pool: WheelItem[],
  size: number,
  random: () => number = Math.random,
  now = Date.now(),
): WheelItem[] {
  const remaining = pool.map((item) => ({ item, weight: ageWeight(item, now) }))
  const picked: WheelItem[] = []
  const target = Math.min(size, remaining.length)

  for (let n = 0; n < target; n++) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0)
    if (total <= 0) {
      // Degenerate weights: fall back to an even pick so we still fill the wheel.
      const index = Math.floor(random() * remaining.length)
      picked.push(remaining.splice(Math.min(index, remaining.length - 1), 1)[0].item)
      continue
    }
    let threshold = random() * total
    let index = 0
    for (; index < remaining.length - 1; index++) {
      threshold -= remaining[index].weight
      if (threshold <= 0) break
    }
    picked.push(remaining.splice(index, 1)[0].item)
  }

  return picked
}
