/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A label that names the other person carries their animal, never the
 * viewer's and never a fixed one: on the other phone a fixed animal is the
 * wrong person. Read from the source, since these are one-line choices.
 */

const root = new URL('..', import.meta.url).pathname

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

// Wording that names the other person.
const NAMES_THEM = /\{them\}|subjectName\(partnerName|possessiveName\(partnerName|\{partnerName/

const offending = (pattern: RegExp) =>
  tsxFiles(root).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, index) => ({ line, at: `${file.slice(root.length)}:${index + 1}` }))
      .filter(({ line }) => pattern.test(line) && NAMES_THEM.test(line))
      .map(({ at }) => at),
  )

describe('animals beside names', () => {
  it("never puts the viewer's own animal beside the other person's name", () => {
    expect(offending(/<Mascot who=\{myMascot\}/)).toEqual([])
  })

  it('never puts a fixed animal beside the other person\'s name', () => {
    expect(offending(/<Mascot who="(raccoon|goldfish)"|<Empty art="(raccoon|goldfish)"/)).toEqual([])
  })

  it('still finds the labels it is meant to be checking', () => {
    expect(offending(/<Mascot who=\{partnerMascot\}/).length).toBeGreaterThanOrEqual(3)
  })
})
