import { useEffect, useState } from 'react'
import { Ground } from '../ui/Ground'
import { TINT } from '../ui/posterColor'
import { EmptyArt } from '../brand/EmptyArt'
import { describeError } from '../lib/dbError'
import { subjectName } from '../utils/names'
import { loadGamePool, loadScores, preloadPosters, submitScore } from './games'
import { MIN_SAFE, MIN_WATCHED, gameName, poolReady, recordFor, sample } from './gameRules'
import type { GameId, GamePool, GameScore } from './gameRules'
import { CatchGame } from './CatchGame'
import { BaitGame } from './BaitGame'

interface GameScreenProps {
  game: GameId
  userId: string
  partnerId: string | null
  partnerName: string | null
  onBack: () => void
  onGoToImport: () => void
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed'; reason: string }
  | { kind: 'empty' }
  | { kind: 'intro' }
  | { kind: 'playing'; run: number }
  | { kind: 'over'; score: number; result: 'saving' | 'saved' | 'failed'; best?: number; beat?: boolean; reason?: string }

const RULES: Record<GameId, string[]> = {
  catch: [
    'Move your finger and she follows.',
    "Catch films you haven't watched for a point.",
    'A ticked poster is one you have watched: catching it costs a life.',
    'Three lives. It speeds up as you score.',
  ],
  bait: [
    'Posters come in and the hooked ones show for a moment.',
    'They turn face down and shuffle. Pick one.',
    'Safe adds one to your chain. Hooked costs a life and the chain.',
    'Bank to keep a chain. Your score is the longest chain you bank.',
  ],
}

// How many posters get fetched before play, so none arrive blank.
const PRELOAD = 36

export function GameScreen({
  game,
  userId,
  partnerId,
  partnerName,
  onBack,
  onGoToImport,
}: GameScreenProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [pool, setPool] = useState<GamePool | null>(null)
  const [scores, setScores] = useState<GameScore[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([loadGamePool(userId, partnerId), loadScores().catch(() => [] as GameScore[])])
      .then(async ([loaded, rows]) => {
        if (cancelled) return
        setScores(rows)
        if (!poolReady(loaded)) {
          setPhase({ kind: 'empty' })
          return
        }
        // A sample of each, fetched now; the game only ever draws from it.
        const inPlay = {
          safe: sample(loaded.safe, PRELOAD, Math.random),
          watched: sample(loaded.watched, Math.ceil(PRELOAD / 2), Math.random),
        }
        await preloadPosters([...inPlay.safe, ...inPlay.watched])
        if (cancelled) return
        setPool(inPlay)
        setPhase({ kind: 'intro' })
      })
      .catch((error: unknown) => {
        if (!cancelled) setPhase({ kind: 'failed', reason: describeError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [userId, partnerId])

  const finish = (score: number) => {
    setPhase({ kind: 'over', score, result: 'saving' })
    void submitScore(game, score)
      .then(async ({ best, beatTheirRecord }) => {
        setScores(await loadScores().catch(() => scores))
        setPhase({ kind: 'over', score, result: 'saved', best, beat: beatTheirRecord })
      })
      .catch((error: unknown) =>
        setPhase({ kind: 'over', score, result: 'failed', reason: describeError(error) }),
      )
  }

  const mine = scores.find((row) => row.userId === userId && row.game === game)
  const record = recordFor(scores, game)
  const holder = record ? (record.holder === userId ? 'you' : subjectName(partnerName)) : null
  const recordLine = record
    ? `Record ${record.score}, set by ${holder} on ${new Date(record.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : 'No record yet'

  return (
    <>
    {/* Behind the game, not inside it: inside, it would paint over
        everything in the game that isn't positioned. */}
    <Ground tints={game === 'catch' ? [TINT.amber, TINT.rust] : [TINT.slate, TINT.amber]} />
    <div className={`game-screen game-${game}`}>
      <div className="game-bar">
        <button type="button" className="game-back" onClick={onBack}>
          ‹ Together
        </button>
        <span className="game-title">{gameName(game)}</span>
      </div>

      {phase.kind === 'loading' && <p className="game-message">Getting the posters…</p>}

      {phase.kind === 'failed' && (
        <p className="game-message line-error">Couldn't load the game: {phase.reason}</p>
      )}

      {phase.kind === 'empty' && (
        <div className="game-panel">
          <EmptyArt kind={game === 'catch' ? 'raccoon' : 'goldfish'} />
          <p className="game-message">
            Nothing to play with yet. This needs at least {MIN_SAFE} films on a watchlist and{' '}
            {MIN_WATCHED} you've watched, with posters.
          </p>
          <button type="button" className="btn-field btn-primary" onClick={onGoToImport}>
            Import your Letterboxd data
          </button>
        </div>
      )}

      {phase.kind === 'intro' && (
        <div className="game-panel">
          <ul className="game-rules">
            {RULES[game].map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="game-record">{recordLine}</p>
          {mine && mine.plays > 0 && <p className="game-best">Your best: {mine.bestScore}</p>}
          <button
            type="button"
            className="btn-field btn-primary"
            onClick={() => setPhase({ kind: 'playing', run: Date.now() })}
          >
            Play
          </button>
        </div>
      )}

      {phase.kind === 'playing' && pool && (
        game === 'catch' ? (
          <CatchGame key={phase.run} pool={pool} onOver={finish} />
        ) : (
          <BaitGame key={phase.run} pool={pool} onOver={finish} />
        )
      )}

      {phase.kind === 'over' && (
        <div className="game-panel">
          <p className="game-score-final">{phase.score}</p>
          <p className="game-message">
            {phase.result === 'saving' && 'Saving…'}
            {phase.result === 'failed' && `That score didn't save: ${phase.reason}`}
            {phase.result === 'saved' &&
              (phase.beat
                ? `A new record. ${subjectName(partnerName, true)} will hear about it next time.`
                : phase.best !== undefined && phase.score >= phase.best && phase.score > 0
                  ? 'Your best yet.'
                  : `Your best is ${phase.best}.`)}
          </p>
          <p className="game-record">{recordLine}</p>
          <button
            type="button"
            className="btn-field btn-primary"
            disabled={phase.result === 'saving'}
            onClick={() => setPhase({ kind: 'playing', run: Date.now() })}
          >
            Play again
          </button>
          <button type="button" className="btn-field" onClick={onBack}>
            Back to Together
          </button>
        </div>
      )}
    </div>
    </>
  )
}
