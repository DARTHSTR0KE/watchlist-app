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
