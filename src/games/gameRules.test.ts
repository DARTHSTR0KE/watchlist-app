import { describe, expect, it } from 'vitest'
import { seededRandom as seeded } from '../test/factories'
import {
  applyShuffle,
  baitRound,
  buildPool,
  catchFallRate,
  catchSpawnMs,
  catchWatchedChance,
  noticeLine,
  poolReady,
  recordFor,
  sample,
  shufflePlan,
} from './gameRules'
import type { GameScore } from './gameRules'

const film = (id: string, posterPath: string | null = `/${id}.jpg`) => ({ id, title: id, posterPath })

describe('buildPool', () => {
  it('takes safe posters from both watchlists, minus anything I have watched', () => {
    const pool = buildPool([film('a'), film('b')], [film('b'), film('c')], [film('c'), film('w')])
    expect(pool.safe.map((f) => f.id).sort()).toEqual(['a', 'b'])
    expect(pool.watched.map((f) => f.id).sort()).toEqual(['c', 'w'])
  })

  it('leaves out films without a poster', () => {
    const pool = buildPool([film('a', null)], [], [film('w', null)])
    expect(pool).toEqual({ safe: [], watched: [] })
  })

  it('is not ready on a fresh account', () => {
    expect(poolReady(buildPool([], [], []))).toBe(false)
    const lots = Array.from({ length: 6 }, (_, i) => film(`s${i}`))
    expect(poolReady(buildPool(lots, [], []))).toBe(false)
    expect(poolReady(buildPool(lots, [], [film('w1'), film('w2'), film('w3')]))).toBe(true)
  })
})

describe('sample', () => {
  it('draws distinct items, as many as there are', () => {
    const drawn = sample([1, 2, 3, 4], 3, seeded(1))
    expect(new Set(drawn).size).toBe(3)
    expect(sample([1, 2], 5, seeded(2))).toHaveLength(2)
  })
})

describe('catch difficulty', () => {
  it('spawns faster and falls faster as the score rises, up to a ceiling', () => {
    expect(catchSpawnMs(10)).toBeLessThan(catchSpawnMs(0))
    expect(catchSpawnMs(1000)).toBe(420)
    expect(catchFallRate(20)).toBeGreaterThan(catchFallRate(0))
    expect(catchFallRate(1000)).toBe(catchFallRate(60))
    expect(catchWatchedChance(1000)).toBeLessThan(0.5)
  })
})

describe('bait difficulty', () => {
  it('starts gentle', () => {
    expect(baitRound(0)).toEqual({ posters: 3, hooks: 1, lookMs: 2200, swapMs: 520, swaps: 3 })
  })

  it('hardens on all four counts as the chain grows', () => {
    const early = baitRound(1)
    const late = baitRound(9)
    expect(late.posters).toBeGreaterThan(early.posters)
    expect(late.hooks).toBeGreaterThan(early.hooks)
    expect(late.lookMs).toBeLessThan(early.lookMs)
    expect(late.swapMs).toBeLessThan(early.swapMs)
  })

  it('never exceeds six posters, and always leaves one safe', () => {
    for (let chain = 0; chain < 60; chain++) {
      const round = baitRound(chain)
      expect(round.posters).toBeLessThanOrEqual(6)
      expect(round.hooks).toBeLessThan(round.posters)
      expect(round.lookMs).toBeGreaterThanOrEqual(700)
      expect(round.swapMs).toBeGreaterThanOrEqual(170)
    }
  })
})

describe('the shuffle', () => {
  it('swaps distinct positions, never the same pair twice running', () => {
    const plan = shufflePlan(4, 50, seeded(3))
    expect(plan).toHaveLength(50)
    for (const [index, [a, b]] of plan.entries()) {
      expect(a).not.toBe(b)
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThan(4)
      if (index > 0) expect([a, b]).not.toEqual(plan[index - 1])
    }
  })

  it('keeps every card, just moved', () => {
    const order = applyShuffle(5, shufflePlan(5, 9, seeded(4)))
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4])
    expect(applyShuffle(3, [[0, 2]])).toEqual([2, 1, 0])
  })
})

describe('recordFor', () => {
  const row = (userId: string, bestScore: number, bestAt: string | null): GameScore => ({
    userId,
    game: 'catch',
    bestScore,
    bestAt,
    plays: 1,
  })

  it('is nobody before anyone has played', () => {
    expect(recordFor([], 'catch')).toBeNull()
    expect(recordFor([row('me', 0, null)], 'catch')).toBeNull()
  })

  it('is the higher best, and the first to set it on a tie', () => {
    const scores = [row('me', 12, '2026-09-20T10:00:00Z'), row('ac', 20, '2026-09-21T10:00:00Z')]
    expect(recordFor(scores, 'catch')).toEqual({ score: 20, holder: 'ac', at: '2026-09-21T10:00:00Z' })
    const tie = [row('me', 20, '2026-09-22T10:00:00Z'), row('ac', 20, '2026-09-21T10:00:00Z')]
    expect(recordFor(tie, 'catch')?.holder).toBe('ac')
  })

  it('keeps the games apart', () => {
    expect(recordFor([row('me', 12, '2026-09-20T10:00:00Z')], 'bait')).toBeNull()
  })
})

describe('noticeLine', () => {
  it('says nothing with nothing waiting', () => {
    expect(noticeLine([])).toBeNull()
  })

  it('names the game and both scores', () => {
    expect(
      noticeLine([{ id: 1, game: 'catch', score: 20, previousScore: 12, createdAt: '2026-09-21T10:00:00Z' }]),
    ).toBe('beat your Catch record: 20, over your 12.')
  })

  it('uses the newest per game, in one line', () => {
    const line = noticeLine([
      { id: 1, game: 'catch', score: 20, previousScore: 12, createdAt: '2026-09-21T10:00:00Z' },
      { id: 2, game: 'catch', score: 25, previousScore: 20, createdAt: '2026-09-22T10:00:00Z' },
      { id: 3, game: 'bait', score: 7, previousScore: 4, createdAt: '2026-09-22T11:00:00Z' },
    ])
    expect(line).toBe('beat your records at Catch (25) and The bait (7).')
  })
})
