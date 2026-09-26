import { useCallback, useEffect, useRef, useState } from 'react'
import { BowlShapes } from '../brand/mark'
import { prefersReducedMotion } from '../brand/coldStart'
import { buildPosterUrl } from '../wheel/posters'
import { LIVES, applyShuffle, baitRound, sample, shufflePlan } from './gameRules'
import type { GamePool, PosterFilm } from './gameRules'

/**
 * The goldfish's game. Posters come in, the hooked ones show for a moment,
 * then all turn face down and shuffle. Pick one: safe grows the chain,
 * hooked costs a life and the chain. Bank to keep a chain; the score is
 * the longest chain banked.
 *
 * Hooked posters are films I have watched, so knowing my own library helps.
 * How many hooks there are is never shown.
 */

interface Card {
  film: PosterFilm
  hooked: boolean
}

type Phase = 'look' | 'hide' | 'shuffle' | 'pick' | 'reveal'

// Face down before the shuffle starts, and how long a result stays up.
const HIDE_MS = 450
const REVEAL_MS = 1100

export function BaitGame({ pool, onOver }: { pool: GamePool; onOver: (score: number) => void }) {
  const still = prefersReducedMotion()
  const [chain, setChain] = useState(0)
  const [banked, setBanked] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [cards, setCards] = useState<Card[]>([])
  // order[slot] = index into cards.
  const [order, setOrder] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('look')
  const [picked, setPicked] = useState<number | null>(null)
  const [swapMs, setSwapMs] = useState(520)
  const timers = useRef<number[]>([])
  const onOverRef = useRef(onOver)
  useEffect(() => {
    onOverRef.current = onOver
  }, [onOver])

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms))
  }
  const clearTimers = () => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  const deal = useCallback(
    (forChain: number) => {
      clearTimers()
      const round = baitRound(forChain)
      const hooks = sample(pool.watched, Math.min(round.hooks, pool.watched.length), Math.random)
      const safes = sample(pool.safe, round.posters - hooks.length, Math.random)
      const dealt: Card[] = [
        ...hooks.map((film) => ({ film, hooked: true })),
        ...safes.map((film) => ({ film, hooked: false })),
      ]
      // Laid out in a random order, so the hooks aren't always first.
      const start = sample(
        dealt.map((_, index) => index),
        dealt.length,
        Math.random,
      )
      setCards(dealt)
      setOrder(start)
      setPicked(null)
      setSwapMs(round.swapMs)
      setPhase('look')
      later(round.lookMs, () => {
        setPhase('hide')
        later(HIDE_MS, () => {
          setPhase('shuffle')
          const plan = shufflePlan(dealt.length, round.swaps, Math.random)
          plan.forEach((_, step) => {
            later(step * round.swapMs, () =>
              setOrder(() => {
                const moved = applyShuffle(dealt.length, plan.slice(0, step + 1))
                return moved.map((position) => start[position])
              }),
            )
          })
          later(plan.length * round.swapMs + 60, () => setPhase('pick'))
        })
      })
    },
    [pool],
  )

  // The first round comes in a beat after the table appears.
  useEffect(() => {
    const first = window.setTimeout(() => deal(0), 250)
    return () => window.clearTimeout(first)
  }, [deal])

  const pick = (cardIndex: number) => {
    if (phase !== 'pick') return
    setPicked(cardIndex)
    setPhase('reveal')
    if (cards[cardIndex].hooked) {
      const left = lives - 1
      setLives(left)
      setChain(0)
      later(REVEAL_MS, () => {
        if (left <= 0) onOverRef.current(banked)
        else deal(0)
      })
    } else {
      const next = chain + 1
      setChain(next)
      later(REVEAL_MS, () => deal(next))
    }
  }

  // Keeps the chain and starts a new one, back at the gentlest round.
  const bank = () => {
    if (chain === 0) return
    setBanked((best) => Math.max(best, chain))
    setChain(0)
    deal(0)
  }

  // Only the card picked turns over: showing the rest would give away how
  // many hooks there were.
  const faceUp = (index: number) => phase === 'look' || (phase === 'reveal' && picked === index)
  const columns = cards.length <= 3 ? cards.length : 3
  const rows = Math.ceil(cards.length / columns)

  return (
    <div className="bait">
      <div className="game-hud">
        <span className="game-score" aria-label={`Chain ${chain}`}>
          {chain}
          <span className="game-score-label"> chain</span>
        </span>
        <span className="game-banked">Best banked {banked}</span>
        <span className="game-lives" aria-label={`${lives} lives left`}>
          {Array.from({ length: LIVES }, (_, index) => (
            <span key={index} className={index < lives ? 'life' : 'life life-lost'} aria-hidden="true">
              ♥
            </span>
          ))}
        </span>
      </div>

      <div className="bait-fish" aria-hidden="true">
        <svg viewBox="0 -28 110 128">
          <BowlShapes uid="bait" swimming={!still} />
        </svg>
      </div>

      <p className="bait-prompt" aria-live="polite">
        {phase === 'look' && 'Remember the hooks.'}
        {(phase === 'hide' || phase === 'shuffle') && 'Watch them move.'}
        {phase === 'pick' && 'Pick one.'}
        {phase === 'reveal' && picked !== null && (cards[picked].hooked ? 'Hooked.' : 'Safe.')}
      </p>

      <div
        className="bait-table"
        style={{ aspectRatio: `${columns * 2} / ${rows * 3}`, maxWidth: `${columns * 110}px` }}
      >
        {cards.map((card, index) => {
          const slot = order.indexOf(index)
          const col = slot % columns
          const row = Math.floor(slot / columns)
          const up = faceUp(index)
          return (
            <button
              key={`${card.film.id}-${index}`}
              type="button"
              className={`bait-card${up ? ' bait-up' : ''}${still ? ' bait-still' : ''}${
                phase === 'reveal' && picked === index ? ' bait-picked' : ''
              }`}
              style={{
                width: `${100 / columns}%`,
                height: `${100 / rows}%`,
                transform: `translate(${col * 100}%, ${row * 100}%)`,
                transitionDuration: `${swapMs}ms`,
              }}
              disabled={phase !== 'pick'}
              onClick={() => pick(index)}
              aria-label={phase === 'pick' ? `Card ${slot + 1}` : undefined}
            >
              <span className="bait-face">
                {up ? (
                  <>
                    <img src={buildPosterUrl(card.film.posterPath) ?? ''} alt={card.film.title} draggable={false} />
                    {card.hooked && (phase === 'look' || phase === 'reveal') && (
                      <span className="bait-hook" aria-label="Hooked">
                        <svg viewBox="0 0 24 36" aria-hidden="true">
                          <path d="M12 0 V22 A7 7 0 1 1 5 15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                          <path d="M5 15 L2 19" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="bait-back" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="btn-field btn-primary bait-bank"
        disabled={chain === 0 || phase === 'reveal'}
        onClick={bank}
      >
        {chain === 0 ? 'Bank' : `Bank a chain of ${chain}`}
      </button>
    </div>
  )
}
