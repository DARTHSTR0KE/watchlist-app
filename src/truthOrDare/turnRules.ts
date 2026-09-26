/**
 * The rules of the game that can be worked out from the history alone.
 * The database enforces every one of these as well; they are here so the
 * screen can say what is possible before anything is tried.
 *
 * Nothing here touches Supabase, so it can be tested as is.
 */

export const DECKS = ['serious', 'funny', 'flirty', 'spicy'] as const
export type Deck = (typeof DECKS)[number]
export type Kind = 'truth' | 'dare'
export type Mode = 'in_person' | 'virtual'
export type TurnStatus = 'open' | 'answered' | 'passed'

export interface Turn {
  id: string
  drawnBy: string
  player: string
  partner: string
  mode: Mode
  deck: Deck
  kind: Kind
  prompt: string
  status: TurnStatus
  answerText: string | null
  answerPhoto: string | null
  answeredAt: string | null
  reaction: string | null
  reactedAt: string | null
  seenAt: string | null
  createdAt: string
}

export const PASSES_PER_WEEK = 3
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Passes are counted over the last seven days, not a calendar week, so
// the two of us in different time zones count the same week.
export function passesLeft(turns: readonly Turn[], player: string, now: Date): number {
  const since = now.getTime() - WEEK_MS
  const used = turns.filter(
    (turn) =>
      turn.player === player &&
      turn.status === 'passed' &&
      turn.answeredAt !== null &&
      new Date(turn.answeredAt).getTime() > since,
  ).length
  return Math.max(0, PASSES_PER_WEEK - used)
}

// Newest first, whatever order they arrived in.
function newestFirst(turns: readonly Turn[]): Turn[] {
  return [...turns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Virtual play takes turns. Mine is open when I have drawn and not yet
 * answered; it is theirs when I went last or they are mid-turn; otherwise
 * it is mine to draw.
 */
export type VirtualState =
  | { kind: 'open'; turn: Turn }
  | { kind: 'their-turn'; last: Turn }
  | { kind: 'my-turn' }

export function virtualState(turns: readonly Turn[], me: string): VirtualState {
  const virtual = newestFirst(turns).filter((turn) => turn.mode === 'virtual')
  const mine = virtual.find((turn) => turn.player === me && turn.status === 'open')
  if (mine) return { kind: 'open', turn: mine }
  const last = virtual[0]
  if (last && (last.player === me || last.status === 'open')) return { kind: 'their-turn', last }
  return { kind: 'my-turn' }
}

// Their finished virtual turns I haven't looked at yet, oldest first so
// they read in the order they happened.
export function waitingForMe(turns: readonly Turn[], me: string): Turn[] {
  return newestFirst(turns)
    .filter(
      (turn) =>
        turn.mode === 'virtual' &&
        turn.partner === me &&
        turn.status !== 'open' &&
        turn.seenAt === null,
    )
    .reverse()
}

// In person on this phone: the card still in front of us, if any.
export function openInPersonTurn(turns: readonly Turn[], me: string): Turn | null {
  return (
    newestFirst(turns).find(
      (turn) => turn.mode === 'in_person' && turn.drawnBy === me && turn.status === 'open',
    ) ?? null
  )
}

// In person, turns alternate: whoever didn't go last on this phone.
export function nextInPersonPlayer(turns: readonly Turn[], me: string, them: string): string {
  const last = newestFirst(turns).find((turn) => turn.mode === 'in_person' && turn.drawnBy === me)
  if (!last) return me
  return last.player === me ? them : me
}

/**
 * What the history may show. Their virtual turn still in progress shows
 * that they are on a turn, never the card: nobody reads a card before it
 * has been answered. An in-person card left open is simply not history yet.
 */
export function historyEntries(turns: readonly Turn[], me: string): Turn[] {
  return newestFirst(turns).filter((turn) => {
    if (turn.status !== 'open') return true
    return turn.mode === 'virtual' && turn.player !== me
  })
}

export function deckLabel(deck: Deck): string {
  return deck.charAt(0).toUpperCase() + deck.slice(1)
}

/* ------------------------------------------------------------------ */
/* The warm-up                                                         */
/* ------------------------------------------------------------------ */

/**
 * The first 5 to 7 cards of a session never come from spicy. Nothing on
 * screen says so: the draw just leaves that deck out until it lifts.
 */
export const WARMUP_DECKS: readonly Deck[] = ['serious', 'funny', 'flirty']

// How long without a card before a session is over and the next one
// starts cold again. Virtual turns are hours apart by nature, so its
// session is the run of turns between us rather than one sitting.
export const SESSION_GAP_MS: Record<Mode, number> = {
  in_person: 30 * 60 * 1000,
  virtual: 12 * 60 * 60 * 1000,
}

// When the warm-up lifts: after 5, 6 or 7 cards, read from the session's
// first card so it can't be predicted and doesn't change if the app is
// reopened mid-session.
export function warmupLength(firstCardId: string): number {
  let hash = 2166136261
  for (let index = 0; index < firstCardId.length; index++) {
    hash ^= firstCardId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return 5 + ((hash >>> 0) % 3)
}

/**
 * The cards of the current session, oldest first. In person: drawn on
 * this phone since the app was opened, with no gap of more than half an
 * hour. Virtual: our turns with no gap longer than twelve hours.
 */
export function sessionCards(
  turns: readonly Turn[],
  mode: Mode,
  me: string,
  now: Date,
  openedAt: number,
): Turn[] {
  const gap = SESSION_GAP_MS[mode]
  const session: Turn[] = []
  let later = now.getTime()
  for (const turn of newestFirst(turns)) {
    if (turn.mode !== mode) continue
    if (mode === 'in_person' && turn.drawnBy !== me) continue
    const at = new Date(turn.createdAt).getTime()
    if (later - at > gap) break
    if (mode === 'in_person' && at < openedAt) break
    session.push(turn)
    later = at
  }
  return session.reverse()
}

// Whether the next draw is still in the warm-up.
export function inWarmup(
  turns: readonly Turn[],
  mode: Mode,
  me: string,
  now: Date,
  openedAt: number,
): boolean {
  const session = sessionCards(turns, mode, me, now, openedAt)
  if (session.length === 0) return true
  return session.length < warmupLength(session[0].id)
}

// The warm-up decks in a random order, tried in turn until one has a card.
export function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}
