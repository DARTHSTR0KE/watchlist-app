import { describe, expect, it } from 'vitest'
import {
  historyEntries,
  nextInPersonPlayer,
  openInPersonTurn,
  passesLeft,
  virtualState,
  waitingForMe,
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
