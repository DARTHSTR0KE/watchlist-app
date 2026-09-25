import { describe, expect, it } from 'vitest'
import { IDLE_SCENES, PLAY_CHANCE, chooseScene, nextInTurn } from './idleScenes'

// A fixed sequence of "random" numbers, so each rule can be pinned down.
const sequence = (...values: number[]) => {
  let index = 0
  return () => values[index++ % values.length]
}

describe('chooseScene', () => {
  it('plays on about one visit in five', () => {
    const fresh = { lastVisitPlayed: false, lastScene: null }
    expect(chooseScene(fresh, sequence(PLAY_CHANCE - 0.01, 0))).not.toBeNull()
    expect(chooseScene(fresh, sequence(PLAY_CHANCE, 0))).toBeNull()
  })

  it('never plays two visits running', () => {
    expect(chooseScene({ lastVisitPlayed: true, lastScene: 'sway' }, sequence(0, 0))).toBeNull()
  })

  it('never picks the one shown last', () => {
    for (let i = 0; i < 40; i += 1) {
      const pick = chooseScene({ lastVisitPlayed: false, lastScene: 'high-five' }, sequence(0, i / 40))
      expect(pick).not.toBe('high-five')
    }
  })

  it('can reach every other scene', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 90; i += 1) {
      const pick = chooseScene({ lastVisitPlayed: false, lastScene: 'doze' }, sequence(0, i / 90))
      if (pick) seen.add(pick)
    }
    expect(seen.size).toBe(IDLE_SCENES.length - 1)
    expect(seen.has('doze')).toBe(false)
  })

  it('has ten', () => {
    expect(IDLE_SCENES).toHaveLength(10)
  })
})

// Temporary, with the forcing it tests.
describe('nextInTurn', () => {
  it('goes through all ten in order and wraps round', () => {
    const seen: string[] = []
    let last: (typeof IDLE_SCENES)[number] | null = null
    for (let i = 0; i < 11; i++) {
      last = nextInTurn(last)
      seen.push(last)
    }
    expect(seen.slice(0, 10)).toEqual([...IDLE_SCENES])
    expect(seen[10]).toBe(IDLE_SCENES[0])
  })
})
