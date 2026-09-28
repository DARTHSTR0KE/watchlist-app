import { describe, expect, it } from 'vitest'
import { showsDebugPanels } from './debugAccess'

describe('the debug panels', () => {
  it('show on the goldfish account', () => {
    expect(showsDebugPanels('goldfish')).toBe(true)
  })

  it('never show for the raccoon, or before the profile has loaded', () => {
    expect(showsDebugPanels('raccoon')).toBe(false)
    expect(showsDebugPanels(null)).toBe(false)
    expect(showsDebugPanels(undefined)).toBe(false)
  })
})
