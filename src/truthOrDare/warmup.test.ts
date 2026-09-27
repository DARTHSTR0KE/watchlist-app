import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Deck, Turn } from './turnRules'

/**
 * The warm-up through the draw itself. Supabase is replaced by a stand-in
 * that records which deck each draw asked for and hands back a turn with a
 * placeholder prompt; no card text is involved anywhere.
 */

const asked: (Deck | null)[] = []
let emptyDecks = new Set<Deck>()

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    rpc: async (name: string, args: { p_deck: Deck | null }) => {
      if (name !== 'draw_card') throw new Error(`unexpected ${name}`)
      asked.push(args.p_deck)
      if (args.p_deck && emptyDecks.has(args.p_deck)) return { data: [], error: null }
      return { data: [{ deck: args.p_deck ?? 'spicy' }], error: null }
    },
  },
}))

const { drawForSession } = await import('./truthOrDare')
const { inWarmup, warmupLength } = await import('./turnRules')

const ME = 'me'
const OPENED = Date.UTC(2026, 8, 26, 11)

function played(id: string, minute: number): Turn {
  const at = new Date(Date.UTC(2026, 8, 26, 12, minute)).toISOString()
  return {
    id,
    drawnBy: ME,
    player: ME,
    partner: 'them',
    mode: 'in_person',
    deck: 'funny',
    kind: 'truth',
    prompt: '',
    status: 'answered',
    answerText: null,
    answerPhoto: null,
    answeredAt: at,
    reaction: null,
    reactedAt: null,
    seenAt: null,
    createdAt: at,
  }
}

// Plays a session of twelve cards, a minute apart, and returns what each
// draw asked the database for.
async function playSession(tag: string): Promise<(Deck | null)[]> {
  const history: Turn[] = []
  const requests: (Deck | null)[] = []
  for (let n = 0; n < 12; n++) {
    const now = new Date(Date.UTC(2026, 8, 26, 12, n))
    const warm = inWarmup(history, 'in_person', ME, now, OPENED)
    asked.length = 0
    await drawForSession('truth', 'in_person', ME, warm)
    requests.push(asked[0])
    history.push(played(`${tag}-${n}`, n))
  }
  return requests
}

beforeEach(() => {
  asked.length = 0
  emptyDecks = new Set()
})

describe('the warm-up, through the draw', () => {
  it('never asks for spicy in the first cards, then opens every deck', async () => {
    const requests = await playSession('a')
    const lift = warmupLength('a-0')
    requests.slice(0, lift).forEach((deck) => {
      expect(deck).not.toBeNull()
      expect(deck).not.toBe('spicy')
    })
    // Past the warm-up the database's own random pick, spicy included.
    requests.slice(lift).forEach((deck) => expect(deck).toBeNull())
  })

  it('lifts after 5, 6 or 7 cards, and not at the same place every session', async () => {
    const lifts = new Set<number>()
    for (let session = 0; session < 40; session++) {
      const requests = await playSession(`s${session}`)
      const lift = requests.indexOf(null)
      expect(lift).toBeGreaterThanOrEqual(5)
      expect(lift).toBeLessThanOrEqual(7)
      lifts.add(lift)
    }
    expect([...lifts].sort()).toEqual([5, 6, 7])
  })

  it('falls through to another gentle deck when one has run out, never to spicy', async () => {
    emptyDecks = new Set<Deck>(['serious', 'funny'])
    const turn = await drawForSession('dare', 'in_person', ME, true)
    expect(turn?.deck).toBe('flirty')
    expect(asked).not.toContain('spicy')
    expect(asked).not.toContain(null)
  })

  it('draws nothing in the warm-up when the gentle decks are all out', async () => {
    emptyDecks = new Set<Deck>(['serious', 'funny', 'flirty'])
    expect(await drawForSession('dare', 'virtual', ME, true)).toBeNull()
    expect([...asked].sort()).toEqual(['flirty', 'funny', 'serious'])
  })
})
