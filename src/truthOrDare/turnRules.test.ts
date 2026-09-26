import { describe, expect, it } from 'vitest'
import {
  historyEntries,
  nextInPersonPlayer,
  openInPersonTurn,
  passesLeft,
  virtualState,
  waitingForMe,
  WARMUP_DECKS,
  inWarmup,
  sessionCards,
  shuffled,
  warmupLength,
} from './turnRules'
import type { Turn } from './turnRules'

const ME = 'me'
const THEM = 'them'

let clock = 0
// A turn with everything filled in, created a minute after the last one.
function turn(overrides: Partial<Turn>): Turn {
  clock += 1
  const player = overrides.player ?? ME
  return {
    id: `t${clock}`,
    drawnBy: player,
    player,
    partner: player === ME ? THEM : ME,
    mode: 'virtual',
    deck: 'funny',
    kind: 'truth',
    prompt: 'A card',
    status: 'answered',
    answerText: 'An answer',
    answerPhoto: null,
    answeredAt: new Date(Date.UTC(2026, 8, 25, 12, clock)).toISOString(),
    reaction: null,
    reactedAt: null,
    seenAt: null,
    createdAt: new Date(Date.UTC(2026, 8, 25, 12, clock)).toISOString(),
    ...overrides,
  }
}

const NOW = new Date(Date.UTC(2026, 8, 26, 12))

describe('passesLeft', () => {
  it('allows three in any seven days', () => {
    expect(passesLeft([], ME, NOW)).toBe(3)
    const two = [turn({ status: 'passed' }), turn({ status: 'passed' })]
    expect(passesLeft(two, ME, NOW)).toBe(1)
    expect(passesLeft([...two, turn({ status: 'passed' })], ME, NOW)).toBe(0)
  })

  it('counts each of us separately', () => {
    const theirs = [turn({ status: 'passed', player: THEM })]
    expect(passesLeft(theirs, ME, NOW)).toBe(3)
    expect(passesLeft(theirs, THEM, NOW)).toBe(2)
  })

  it('gives a pass back once it is more than seven days old', () => {
    const old = turn({ status: 'passed', answeredAt: '2026-09-18T11:00:00.000Z' })
    expect(passesLeft([old], ME, NOW)).toBe(3)
  })

  it('counts passes made in person on either phone', () => {
    const inPerson = turn({ status: 'passed', mode: 'in_person', player: ME, drawnBy: THEM })
    expect(passesLeft([inPerson], ME, NOW)).toBe(2)
  })
})

describe('virtualState', () => {
  it('is my turn when nobody has played', () => {
    expect(virtualState([], ME)).toEqual({ kind: 'my-turn' })
  })

  it('hands over once I have answered', () => {
    const mine = turn({ player: ME })
    expect(virtualState([mine], ME)).toEqual({ kind: 'their-turn', last: mine })
  })

  it('stays theirs while they are mid-turn', () => {
    const theirs = turn({ player: THEM, status: 'open' })
    expect(virtualState([turn({ player: ME }), theirs], ME).kind).toBe('their-turn')
  })

  it('comes back to me once they have answered or passed', () => {
    expect(virtualState([turn({ player: ME }), turn({ player: THEM })], ME).kind).toBe('my-turn')
    expect(virtualState([turn({ player: THEM, status: 'passed' })], ME).kind).toBe('my-turn')
  })

  it('puts my open card back in front of me', () => {
    const open = turn({ player: ME, status: 'open' })
    expect(virtualState([turn({ player: THEM }), open], ME)).toEqual({ kind: 'open', turn: open })
  })

  it('ignores in-person turns', () => {
    const history = [turn({ player: ME }), turn({ mode: 'in_person', player: THEM, drawnBy: ME })]
    expect(virtualState(history, ME).kind).toBe('their-turn')
  })
})

describe('waitingForMe', () => {
  it('is their finished virtual turns I have not seen, oldest first', () => {
    const first = turn({ player: THEM })
    const seen = turn({ player: THEM, seenAt: '2026-09-25T13:00:00.000Z' })
    const open = turn({ player: THEM, status: 'open' })
    const second = turn({ player: THEM, status: 'passed' })
    const mine = turn({ player: ME })
    expect(waitingForMe([second, mine, open, seen, first], ME).map((t) => t.id)).toEqual([
      first.id,
      second.id,
    ])
  })
})

describe('in person', () => {
  it('starts with me, then alternates', () => {
    expect(nextInPersonPlayer([], ME, THEM)).toBe(ME)
    const mine = turn({ mode: 'in_person', player: ME, drawnBy: ME })
    expect(nextInPersonPlayer([mine], ME, THEM)).toBe(THEM)
    const theirs = turn({ mode: 'in_person', player: THEM, drawnBy: ME })
    expect(nextInPersonPlayer([mine, theirs], ME, THEM)).toBe(ME)
  })

  it('goes by this phone alone', () => {
    const onTheirPhone = turn({ mode: 'in_person', player: ME, drawnBy: THEM })
    expect(nextInPersonPlayer([onTheirPhone], ME, THEM)).toBe(ME)
  })

  it('finds the card still on the table', () => {
    const open = turn({ mode: 'in_person', player: THEM, drawnBy: ME, status: 'open' })
    expect(openInPersonTurn([turn({}), open], ME)).toBe(open)
    expect(openInPersonTurn([turn({})], ME)).toBeNull()
  })
})

describe('historyEntries', () => {
  it('shows their turn in progress but never my own open card', () => {
    const theirsOpen = turn({ player: THEM, status: 'open' })
    const mineOpen = turn({ player: ME, status: 'open' })
    const inPersonOpen = turn({ mode: 'in_person', status: 'open' })
    const done = turn({ status: 'passed' })
    expect(historyEntries([theirsOpen, mineOpen, inPersonOpen, done], ME).map((t) => t.id)).toEqual(
      [done.id, theirsOpen.id],
    )
  })
})

describe('the warm-up', () => {
  const at = (minutesAfterNoon: number) =>
    new Date(Date.UTC(2026, 8, 26, 12, minutesAfterNoon)).toISOString()
  const card = (id: string, minutes: number, overrides: Partial<Turn> = {}): Turn =>
    turn({ id, createdAt: at(minutes), mode: 'in_person', drawnBy: ME, ...overrides })
  const openedAt = Date.UTC(2026, 8, 26, 11, 0)

  it('lifts after 5, 6 or 7 cards, the same every time for the same session', () => {
    const lengths = new Set<number>()
    for (let i = 0; i < 300; i++) {
      const length = warmupLength(`card-${i}`)
      expect(length).toBeGreaterThanOrEqual(5)
      expect(length).toBeLessThanOrEqual(7)
      lengths.add(length)
    }
    expect([...lengths].sort()).toEqual([5, 6, 7])
    expect(warmupLength('abc')).toBe(warmupLength('abc'))
  })

  it('starts a session warm, and lifts once enough cards are drawn', () => {
    const now = new Date(at(20))
    expect(inWarmup([], 'in_person', ME, now, openedAt)).toBe(true)
    const history = Array.from({ length: 7 }, (_, i) => card(`c${i}`, i))
    const lift = warmupLength('c0')
    expect(inWarmup(history.slice(0, lift - 1), 'in_person', ME, now, openedAt)).toBe(true)
    expect(inWarmup(history.slice(0, lift), 'in_person', ME, now, openedAt)).toBe(false)
  })

  it('starts again after a long gap', () => {
    const history = Array.from({ length: 7 }, (_, i) => card(`c${i}`, i))
    expect(inWarmup(history, 'in_person', ME, new Date(at(10)), openedAt)).toBe(false)
    // Forty minutes after the last card: a new session, warm again.
    expect(inWarmup(history, 'in_person', ME, new Date(at(46)), openedAt)).toBe(true)
  })

  it('starts again when the app is opened again', () => {
    const history = Array.from({ length: 7 }, (_, i) => card(`c${i}`, i))
    const reopened = Date.UTC(2026, 8, 26, 12, 7)
    expect(inWarmup(history, 'in_person', ME, new Date(at(8)), reopened)).toBe(true)
  })

  it('counts only this phone in person, and both of us virtually', () => {
    const now = new Date(at(20))
    const onTheirPhone = Array.from({ length: 7 }, (_, i) => card(`t${i}`, i, { drawnBy: THEM }))
    expect(inWarmup(onTheirPhone, 'in_person', ME, now, openedAt)).toBe(true)
    const virtual = Array.from({ length: 7 }, (_, i) =>
      card(`v${i}`, i * 60, { mode: 'virtual', player: i % 2 ? THEM : ME, drawnBy: i % 2 ? THEM : ME }),
    )
    // Hours apart, but within twelve of each other: one session.
    expect(inWarmup(virtual, 'virtual', ME, new Date(at(7 * 60)), openedAt)).toBe(false)
    expect(sessionCards(virtual, 'virtual', ME, new Date(at(7 * 60)), openedAt)).toHaveLength(7)
  })

  it('shuffles the warm-up decks without losing any', () => {
    const order = shuffled(WARMUP_DECKS, Math.random)
    expect([...order].sort()).toEqual(['flirty', 'funny', 'serious'])
    expect(order).not.toContain('spicy')
  })
})
