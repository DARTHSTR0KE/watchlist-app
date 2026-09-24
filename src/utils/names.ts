/**
 * A name is one person and takes "sees"; the pronoun that stands in for a
 * name nobody could read is "they", which takes "see". Writing the verb
 * once for the name is how "What ac see" and "them has answered" happen.
 */

// Who, as the subject of a sentence: the name, or "they".
export function subjectName(name: string | null, capitalise = false): string {
  if (name) return name
  return capitalise ? 'They' : 'they'
}

// The verb that goes with it: "sees" for a name, "see" for they.
export function agree(name: string | null, forName: string, forThey: string): string {
  return name ? forName : forThey
}

// Whose: "ac's", or "their".
export function possessiveName(name: string | null): string {
  return name ? `${name}'s` : 'their'
}
