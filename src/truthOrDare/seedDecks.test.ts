/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DECKS } from './turnRules'

/**
 * The seed files, decoded in memory and counted. Nothing here may print a
 * card: every assertion compares numbers, never card text, so a failure
 * says how many and never which.
 */

interface SeedCard {
  deck: string
  kind: string
  body: string
  in_person_only: boolean
}

const FILES: Record<(typeof DECKS)[number], string> = {
  serious: 'truth-or-dare-seed-1-serious.sql',
  funny: 'truth-or-dare-seed-2-funny.sql',
  flirty: 'truth-or-dare-seed-3-flirty.sql',
  spicy: 'truth-or-dare-seed-4-spicy.sql',
}

function payloads(file: string): string[] {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')
  return [...source.matchAll(/decode\('([A-Za-z0-9+/=]+)'/g)].map((match) => match[1])
}

function cards(file: string): SeedCard[] {
  return payloads(file).flatMap(
    (encoded) => JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as SeedCard[],
  )
}

describe.each(DECKS)('the %s deck', (deck) => {
  const all = cards(FILES[deck])
  const count = (test: (card: SeedCard) => boolean) => all.filter(test).length

  it('has 50 truths and 50 dares, all in this deck', () => {
    expect(all.length).toBe(100)
    expect(count((card) => card.deck === deck)).toBe(100)
    expect(count((card) => card.kind === 'truth')).toBe(50)
    expect(count((card) => card.kind === 'dare')).toBe(50)
  })

  it('marks half the dares in person only, and no truths', () => {
    expect(count((card) => card.kind === 'dare' && card.in_person_only)).toBe(25)
    expect(count((card) => card.kind === 'truth' && card.in_person_only)).toBe(0)
  })

  it('has no blank or repeated card', () => {
    expect(count((card) => card.body.trim().length === 0)).toBe(0)
    const distinct = new Set(all.map((card) => card.body.trim().toLowerCase())).size
    expect(distinct).toBe(all.length)
  })
})

describe('across the decks', () => {
  it('repeats no card from one deck in another', () => {
    const bodies = DECKS.flatMap((deck) => cards(FILES[deck]).map((card) => card.body.trim().toLowerCase()))
    expect(bodies.length).toBe(400)
    expect(new Set(bodies).size).toBe(400)
  })

  it('has the spicy rewrite carrying the same deck as the spicy seed', () => {
    const same = payloads('truth-or-dare-spicy-rewrite.sql').join() === payloads(FILES.spicy).join()
    expect(same).toBe(true)
  })
})
