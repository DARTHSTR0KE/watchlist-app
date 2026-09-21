/**
 * Which animal stands for which person is a fact about the people, kept in
 * profiles.mascot and read at render time. Nothing here decides it, and no
 * screen may assume it: change the column and the app follows.
 *
 * The constraint on the column allows only these two, but the parse stays
 * defensive anyway — an unrecognised value renders nothing, which is a far
 * better failure than quietly attributing the wrong animal to someone.
 */
export type Mascot = 'raccoon' | 'goldfish'

export function parseMascot(value: string | null | undefined): Mascot | null {
  const normalised = value?.trim().toLowerCase()
  if (normalised === 'raccoon') return 'raccoon'
  if (normalised === 'goldfish') return 'goldfish'
  return null
}
