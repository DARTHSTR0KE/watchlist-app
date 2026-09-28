import { describe, expect, it } from 'vitest'
import { showsMasterOnly } from './debugAccess'

describe('the debug panels', () => {
  it('show when the database says this is the master account', () => {
    expect(showsMasterOnly(true)).toBe(true)
  })

  it('never show otherwise, including while still asking or after a failure', () => {
    expect(showsMasterOnly(false)).toBe(false)
    expect(showsMasterOnly(null)).toBe(false)
  })
})
