/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * There is no walkthrough. profiles.onboarded_at stays in the database,
 * but nothing in the app reads or writes it, so nothing can bring one back.
 */

const root = new URL('..', import.meta.url).pathname

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(path) && !/\.test\.ts$/.test(path) ? [path] : []
  })
}

describe('no onboarding', () => {
  it('nothing in the app reads or writes onboarded_at', () => {
    const users = sourceFiles(root)
      // The generated types describe the column; they don't use it.
      .filter((file) => !file.endsWith('types/supabase.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes('onboarded_at'))
      .map((file) => file.slice(root.length))
    expect(users).toEqual([])
  })

  it('has no walkthrough left to show', () => {
    const users = sourceFiles(root)
      .filter((file) => /Onboarding|markOnboarded|onboard-/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(root.length))
    expect(users).toEqual([])
  })
})
