import { useEffect, useState } from 'react'
import { IdleScene } from '../brand/PairScene'
import { ScreenCharacter } from '../brand/Ambient'
import { Row, Rows, Screen } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { DriftingGround } from '../ui/Ground'
import { TINT } from '../ui/posterColor'
import { reportQuietly } from '../lib/dbError'
import { subjectName } from '../utils/names'
import { plural } from '../social/ticketFacts'
import { loadTurns } from '../truthOrDare/truthOrDare'
import { virtualState, waitingForMe } from '../truthOrDare/turnRules'
import type { Turn } from '../truthOrDare/turnRules'
import { loadScores } from './games'
import { GAMES, recordFor } from './gameRules'
import type { GameId, GameScore } from './gameRules'

interface GamesScreenProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  onBack: () => void
  onPlayGame: (game: GameId) => void
  onPlayTruthOrDare: () => void
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * The three things in Together that aren't about choosing a film: Catch,
 * The bait and truth or dare, each with its record or where it stands.
 * Same ground as Together, both of them on it.
 */
export function GamesScreen({
  userId,
  partnerId,
  partnerName,
  onBack,
  onPlayGame,
  onPlayTruthOrDare,
}: GamesScreenProps) {
  const [scores, setScores] = useState<GameScore[] | null>(null)
  const [turns, setTurns] = useState<Turn[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadScores()
      .then((rows) => {
        if (!cancelled) setScores(rows)
      })
      .catch((error: unknown) => {
        reportQuietly('Reading the game records', error)
        if (!cancelled) setScores([])
      })
    if (partnerId) {
      void loadTurns()
        .then((rows) => {
          if (!cancelled) setTurns(rows)
        })
        .catch((error: unknown) => {
          reportQuietly('Reading the truth or dare history', error)
          if (!cancelled) setTurns([])
        })
    }
    return () => {
      cancelled = true
    }
  }, [partnerId])

  const loading = scores === null || (partnerId !== null && turns === null)
  const them = subjectName(partnerName)

  // Across all three: how much has been played between us.
  const gamesPlayed = (scores ?? []).reduce((sum, row) => sum + row.plays, 0)
  const cardsPlayed = (turns ?? []).filter((turn) => turn.status !== 'open').length
  const played = gamesPlayed + cardsPlayed

  // Who holds what.
  const records = GAMES.map((game) => (scores ? recordFor(scores, game.id) : null))
  const mine = records.filter((record) => record?.holder === userId).length
  const theirs = records.filter((record) => record && record.holder !== userId).length
  const recordsLine =
    mine + theirs === 0
      ? 'No records set yet'
      : theirs === 0
        ? `You hold ${mine === GAMES.length ? 'both records' : 'the only record'}`
        : mine === 0
          ? `${subjectName(partnerName, true)} ${theirs === GAMES.length ? 'holds both records' : 'holds the only record'}`
          : `One record each`

  const waiting = turns ? waitingForMe(turns, userId) : []
  const state = turns ? virtualState(turns, userId) : null
  const truthOrDareMeta = !partnerId
    ? 'Needs the two of you linked'
    : turns === null
      ? 'In person or apart, one card at a time'
      : waiting.length > 0
        ? `${subjectName(partnerName, true)} took a turn — yours next`
        : state?.kind === 'open'
          ? 'Your card is waiting for an answer'
          : state?.kind === 'their-turn'
            ? `Waiting on ${them}`
            : cardsPlayed > 0
              ? `${plural(cardsPlayed, 'card')} played`
              : 'In person or apart, one card at a time'

  return (
    <Screen ground={<DriftingGround left={TINT.amber} right={TINT.rust} />}>
      <button type="button" className="td-switch" onClick={onBack}>
        ‹ Together
      </button>
      <Ticket
        heading="GAMES"
        figure={loading ? '…' : `${played} played`}
        line={loading ? 'Adding it up' : recordsLine}
        perforation={
          waiting.length > 0 ? `${them.toUpperCase()} TOOK A TURN AT TRUTH OR DARE` : undefined
        }
      />

      <div className="together-pair">
        <IdleScene busy={loading} fallback={<ScreenCharacter kind="pair" />} />
      </div>

      <Rows>
        {GAMES.map((game, index) => {
          const record = records[index]
          const holder = record ? (record.holder === userId ? 'you' : them) : null
          return (
            <Row
              key={game.id}
              name={game.name}
              meta={
                scores === null
                  ? `With ${game.who}`
                  : record
                    ? `Record ${record.score} · ${holder} · ${shortDate(record.at)}`
                    : `With ${game.who} · no record yet`
              }
              onOpen={() => onPlayGame(game.id)}
            />
          )
        })}
        <Row name="Truth or dare" meta={truthOrDareMeta} onOpen={onPlayTruthOrDare} />
      </Rows>
    </Screen>
  )
}
