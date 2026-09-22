import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The resolution is the thing under test, not the network. The client is
 * replaced by a fake that answers the same three queries pendingWatches
 * makes, and enforces the same rule the policy does: you see your own
 * rows, plus any row at all where together is true.
 *
 * The fixture is the shape the real bug had — four together rows, none of
 * them shared, and one account with a history long enough that its own
 * together rows fall outside the most recent WATCHED_LIMIT.
 */

const AC = 'ac-uuid'
const DARTH = 'darth-uuid'

interface Row {
  user_id: string
  film_id: string
  watched_on: string
  together: boolean | null
}

const row = (user: string, film_id: string, watched_on: string, together: boolean | null): Row => ({
  user_id: user,
  film_id,
  watched_on,
  together,
})

const WATCHED: Row[] = [
  row(AC, 'Memento', '2019-01-03', true),
  row(AC, 'Ran', '2019-01-02', true),
  row(AC, 'Toy Story', '2019-01-01', true),
  row(DARTH, 'Neru', '2026-05-01', true),
]
for (let n = 0; n < 29; n++) {
  WATCHED.push(row(DARTH, `da-alone-${n}`, `2026-04-${String((n % 28) + 1).padStart(2, '0')}`, false))
}
for (let n = 0; n < 305; n++) {
  WATCHED.push(row(AC, `ac-alone-${n}`, `2025-06-${String((n % 28) + 1).padStart(2, '0')}`, false))
}

// Whose session the fake is answering as.
const viewer = { id: AC }

function visibleTo(who: string): Row[] {
  return WATCHED.filter((r) => r.user_id === who || r.together === true)
}

function buildQuery() {
  const filters: Record<string, unknown> = {}
  let headCount = false
  let ordered = false
  let limit: number | null = null

  const resolve = () => {
    let rows = visibleTo(viewer.id)
    if (filters.together === true) rows = rows.filter((r) => r.together === true)
    if (typeof filters.user_id === 'string') rows = rows.filter((r) => r.user_id === filters.user_id)
    if (ordered) rows = [...rows].sort((a, b) => b.watched_on.localeCompare(a.watched_on))

    if (headCount) return { count: rows.length, error: null }
    if (limit !== null) rows = rows.slice(0, limit)
    return {
      data: rows.map((r) => ({
        film_id: r.film_id,
        user_id: r.user_id,
        watched_on: r.watched_on,
        together: r.together,
        films: { title: r.film_id, year: 2001, poster_path: null, backdrop_path: null, letterboxd_uri: null },
      })),
      error: null,
    }
  }

  const query = {
    select(_columns: string, options?: { count?: string; head?: boolean }) {
      if (options?.head) headCount = true
      return query
    },
    eq(column: string, value: unknown) {
      filters[column] = value
      return query
    },
    is(column: string, value: unknown) {
      filters[column] = value
      return query
    },
    order() {
      ordered = true
      return query
    },
    limit(n: number) {
      limit = n
      return query
    },
    // Awaiting the builder is what runs it, the way postgrest-js behaves.
    then(onFulfilled: (value: unknown) => unknown) {
      return Promise.resolve(resolve()).then(onFulfilled)
    },
  }
  return query
}

vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: () => buildQuery() },
}))

const { WATCHED_LIMIT, loadWatchedSplit } = await import('./pendingWatches')

const togetherIds = (split: { together: { filmId: string }[] }) =>
  split.together.map((f) => f.filmId).sort()

describe('watched together', () => {
  beforeEach(() => {
    viewer.id = AC
  })

  it('resolves to the same films from either account', async () => {
    viewer.id = DARTH
    const asDarth = await loadWatchedSplit(DARTH)

    viewer.id = AC
    const asAc = await loadWatchedSplit(AC)

    expect(togetherIds(asDarth)).toEqual(['Memento', 'Neru', 'Ran', 'Toy Story'])
    expect(togetherIds(asAc)).toEqual(togetherIds(asDarth))
    expect(asAc.together).toHaveLength(4)
    expect(asDarth.together).toHaveLength(4)
  })

  /**
   * The original bug. ac's own together rows are older than their most
   * recent three hundred, so materialising the together half out of the
   * per-person read lost them and ac saw one where darth saw four.
   */
  it('finds together films that fall outside a long history’s recent window', async () => {
    viewer.id = AC
    const split = await loadWatchedSplit(AC)
    // More rows than the window, and the together ones are the oldest.
    expect(WATCHED.filter((r) => r.user_id === AC).length).toBeGreaterThan(WATCHED_LIMIT)
    expect(togetherIds(split)).toContain('Memento')
    expect(togetherIds(split)).toContain('Ran')
    expect(togetherIds(split)).toContain('Toy Story')
  })

  it('keeps the two halves disjoint — nothing is counted twice', async () => {
    for (const who of [AC, DARTH]) {
      viewer.id = who
      const split = await loadWatchedSplit(who)
      const inBoth = split.together.filter((t) => split.alone.some((a) => a.filmId === t.filmId))
      expect(inBoth, who).toHaveLength(0)
    }
  })

  it('keeps the alone half private: only ever my own rows', async () => {
    viewer.id = DARTH
    const split = await loadWatchedSplit(DARTH)
    expect(split.alone).toHaveLength(29)
    expect(split.alone.every((f) => f.filmId.startsWith('da-alone-'))).toBe(true)
  })

  it('counts the alone half rather than measuring the list it shows', async () => {
    viewer.id = AC
    const split = await loadWatchedSplit(AC)
    // 305 of them, of which the screen shows the most recent 300. The count
    // has to be the history, not the cap — 300 was the number that looked
    // like a coincidence nobody could explain.
    expect(split.aloneTotal).toBe(305)
    expect(split.alone).toHaveLength(WATCHED_LIMIT)
    expect(split.alone.length).toBeLessThan(split.aloneTotal)
  })

  it('agrees with itself: together plus alone is the whole history', async () => {
    viewer.id = DARTH
    const split = await loadWatchedSplit(DARTH)
    // darth has 30 rows of their own; three of the four together films are
    // ac's, so the screen shows 29 alone and 4 together.
    expect(split.together.length + split.aloneTotal).toBe(33)
  })

  it('marks every film in the together half as together', async () => {
    viewer.id = AC
    const split = await loadWatchedSplit(AC)
    expect(split.together.every((f) => f.together)).toBe(true)
    expect(split.alone.every((f) => !f.together)).toBe(true)
  })

  it('orders both halves newest first', async () => {
    viewer.id = DARTH
    const split = await loadWatchedSplit(DARTH)
    const dates = split.together.map((f) => f.watchedOn ?? '')
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates)
  })
})
