import { createContext, useContext } from 'react'

// Whether the screen's character is actually showing — there is room for
// it below the content. A scene waits while it isn't.
export const CharacterRoom = createContext(true)

export function useCharacterRoom(): boolean {
  return useContext(CharacterRoom)
}
