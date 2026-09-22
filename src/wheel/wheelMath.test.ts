import { describe, expect, it } from 'vitest'
import { getSegmentIndexAtPointer, pickSegment, rotationForSegment } from './wheelMath'
import { film, seededRandom } from '../test/factories'

// Spread across the range rather than one value, because the jitter inside
// a segment is where an off-by-one would hide.
const RANDOMS = [0, 0.13, 0.37, 0.5, 0.74, 0.91, 0.999]

describe('the film under the pointer', () => {
  it('is the one aimed at, for every segment count from 2 to 12', () => {
    for (let count = 2; count <= 12; count++) {
      for (let index = 0; index < count; index++) {
        for (const r of RANDOMS) {
          const rotation = rotationForSegment(0, index, count, () => r)
          expect(getSegmentIndexAtPointer(rotation, count), `count ${count}, index ${index}, r ${r}`).toBe(index)
        }
      }
    }
  })

  it('still lands where it aimed after a spin has left the wheel somewhere odd', () => {
    // Rotation accumulates across spins, so the second spin starts from an
    // angle that is not a multiple of anything.
    let rotation = 0
    const random = seededRandom(7)
    for (let spin = 0; spin < 200; spin++) {
      const count = 2 + (spin % 11)
      const index = spin % count
      rotation = rotationForSegment(rotation, index, count, random)
      expect(getSegmentIndexAtPointer(rotation, count), `spin ${spin}`).toBe(index)
    }
  })

  it('reports the right film after titles are removed from the wheel', () => {
    const all = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => film({ id }))
    // Three taken off, the way a veto or "not tonight" takes them.
    const remaining = all.filter((item) => !['b', 'e', 'g'].includes(item.id))
    expect(remaining).toHaveLength(5)

    for (let index = 0; index < remaining.length; index++) {
      for (const r of RANDOMS) {
        const rotation = rotationForSegment(0, index, remaining.length, () => r)
        const landed = remaining[getSegmentIndexAtPointer(rotation, remaining.length)]
        expect(landed.id).toBe(remaining[index].id)
      }
    }
  })

  it('always turns at least four times, so a spin is never a twitch', () => {
    for (let count = 2; count <= 12; count++) {
      for (const r of RANDOMS) {
        expect(rotationForSegment(0, 0, count, () => r)).toBeGreaterThanOrEqual(4 * 360)
      }
    }
  })
})

describe('spin again', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `film-${i}`)

  it('never returns the film already showing, at any count from 2 to 12', () => {
    const random = seededRandom(99)
    for (let count = 2; count <= 12; count++) {
      const list = ids(count)
      for (const current of list) {
        for (let attempt = 0; attempt < 400; attempt++) {
          const picked = pickSegment(list, current, random)
          expect(list[picked], `count ${count}, current ${current}`).not.toBe(current)
        }
      }
    }
  })

  it('at two films, alternates — there is only one other answer', () => {
    const random = seededRandom(3)
    const list = ids(2)
    for (let attempt = 0; attempt < 200; attempt++) {
      expect(pickSegment(list, 'film-0', random)).toBe(1)
      expect(pickSegment(list, 'film-1', random)).toBe(0)
    }
  })

  it('at three films, uses both of the others rather than only one', () => {
    const random = seededRandom(11)
    const list = ids(3)
    const seen = new Set<number>()
    for (let attempt = 0; attempt < 300; attempt++) {
      seen.add(pickSegment(list, 'film-1', random))
    }
    expect([...seen].sort()).toEqual([0, 2])
  })

  it('lands on a different film end to end, not merely picks a different index', () => {
    const random = seededRandom(5)
    for (const count of [2, 3]) {
      const list = ids(count)
      let rotation = 0
      let current = list[0]
      for (let spin = 0; spin < 300; spin++) {
        const index = pickSegment(list, current, random)
        rotation = rotationForSegment(rotation, index, count, random)
        const landed = list[getSegmentIndexAtPointer(rotation, count)]
        expect(landed, `count ${count}, spin ${spin}`).not.toBe(current)
        current = landed
      }
    }
  })

  it('returns the only film when it is the only one, rather than nothing', () => {
    expect(pickSegment(['only'], 'only', () => 0.5)).toBe(0)
  })

  it('may return anything when no film is showing yet', () => {
    const random = seededRandom(21)
    const list = ids(4)
    const seen = new Set<number>()
    for (let attempt = 0; attempt < 400; attempt++) seen.add(pickSegment(list, null, random))
    expect([...seen].sort()).toEqual([0, 1, 2, 3])
  })

  it('has no segment to pick from an empty wheel', () => {
    expect(pickSegment([], null, () => 0)).toBe(-1)
  })
})
