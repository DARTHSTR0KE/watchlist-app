import { describe, expect, it, vi } from 'vitest'

/**
 * Which rows the game pool asks for. Supabase is a stand-in that records
 * every filter and answers with nothing, so this checks the questions, not
 * the data.
 */

const asked: { table: string; filters: [string, unknown][] }[] = []

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from(table: string) {
      const query = { table, filters: [] as [string, unknown][] }
      asked.push(query)
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          query.filters.push([column, value])
          return chain
        },
        then: (resolve: (result: { data: []; error: null }) => void) => resolve({ data: [], error: null }),
      }
      return chain
    },
  },
}))

const { loadGamePool } = await import('./games')

describe('the game pool', () => {
  it("reads only the player's own watchlist and watched films", async () => {
    asked.length = 0
    await loadGamePool('ac')
    expect(asked.map((query) => query.table).sort()).toEqual(['watched', 'watchlist_items'])
    for (const query of asked) expect(query.filters).toEqual([['user_id', 'ac']])
  })

  it('follows whoever is signed in', async () => {
    asked.length = 0
    await loadGamePool('darth')
    expect(asked.flatMap((query) => query.filters.map(([, value]) => value))).toEqual(['darth', 'darth'])
  })
})
