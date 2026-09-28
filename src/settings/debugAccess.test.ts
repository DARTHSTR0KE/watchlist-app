import { describe, expect, it } from 'vitest'
import { showsDebugPanels } from './debugAccess'

describe('the debug panels', () => {
  it('show when the database says this is the master account', () => {
    expect(showsDebugPanels(true)).toBe(true)
  })

  it('never show otherwise, including while still asking or after a failure', () => {
    expect(showsDebugPanels(false)).toBe(false)
    expect(showsDebugPanels(null)).toBe(false)
  })
})
