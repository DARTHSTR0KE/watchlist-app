import { describe, expect, it } from 'vitest'
import { agree, possessiveName, subjectName } from './names'

describe('a name in a sentence', () => {
  it('takes a singular verb, and they takes a plural one', () => {
    const say = (name: string | null) => `What ${subjectName(name)} ${agree(name, 'sees', 'see')}`
    expect(say('ac')).toBe('What ac sees')
    expect(say(null)).toBe('What they see')
  })

  it('capitalises the pronoun at the start of a sentence', () => {
    expect(subjectName(null, true)).toBe('They')
    expect(subjectName('ac', true)).toBe('ac')
  })

  it('owns things as a name or as their', () => {
    expect(possessiveName('ac')).toBe("ac's")
    expect(possessiveName(null)).toBe('their')
  })
})
