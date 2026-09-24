import { useId } from 'react'
import { BOWL, RACCOON } from './paths'
import { BowlShapes, GoldfishShapes, RaccoonBackShapes, RaccoonShapes, ZzzShapes } from './mark'
import { prefersReducedMotion } from './coldStart'
import { Tappable } from './Tappable'
import type { Reaction } from '../ambient/ambient'

/**
 * The pair, living in the app rather than only on the splash. Each of
 * these is a different drawing on purpose — the same one on five screens
 * stops being charming — and each is beside what it comments on, never in
 * front of it. Reduced motion keeps the drawing and drops the movement.
 */

function useUid(): string {
  return useId().replace(/:/g, '')
}

/** Watched: both of them asleep, the fish in its bowl. */
export function SleepingPairMoment() {
  const uid = useUid()
  const still = prefersReducedMotion()
  return (
    <span className="amb-pair">
      <Tappable who="raccoon">
        <svg className="moment amb-sleep-raccoon" viewBox={RACCOON.viewBox} aria-hidden="true">
          <g transform="rotate(-10 50 60)">
            <RaccoonShapes eyes="closed" />
          </g>
        </svg>
      </Tappable>
      <Tappable who="goldfish">
        <svg className="moment amb-sleep-bowl" viewBox="0 -24 100 124" aria-hidden="true">
          <BowlShapes uid={uid} fishEye="closed" />
          <g transform="translate(66 -8)" className={still ? undefined : 'amb-zzz-rise'}>
            <ZzzShapes />
          </g>
        </svg>
      </Tappable>
    </span>
  )
}

/**
 * Peering over the edge of a loading state: the top of a head and a pair
 * of eyes above a line, bobbing up to look and back down. Which animal is
 * the caller's to choose, so loading screens differ from each other.
 */
export function PeerMoment({ who }: { who: 'raccoon' | 'goldfish' }) {
  const uid = useUid()
  const still = prefersReducedMotion()
  const clip = `peer-clip-${uid}`
  return (
    <Tappable who={who}>
      <svg className="moment amb-peer" viewBox="0 0 100 60" aria-hidden="true">
        <clipPath id={clip}>
          <rect x="0" y="0" width="100" height="48" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <g className={still ? undefined : 'amb-peer-bob'}>
            {who === 'raccoon' ? (
              <g transform="translate(14 -4) scale(0.72)">
                <RaccoonShapes />
              </g>
            ) : (
              <g transform="translate(8 18) scale(0.8)">
                <GoldfishShapes />
              </g>
            )}
          </g>
        </g>
        <line
          x1="2"
          y1="48"
          x2="98"
          y2="48"
          className="amb-edge"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </Tappable>
  )
}

/** In the corner of the wheel while it spins: watching it go round. */
export function WheelWatcher() {
  const still = prefersReducedMotion()
  return (
    <span className="amb-watcher" aria-hidden="true">
      <Tappable who="raccoon">
        <svg className={`moment${still ? '' : ' amb-watcher-rise'}`} viewBox="0 0 100 64">
          <g className={still ? undefined : 'amb-watcher-look'}>
            <g transform="translate(10 0) scale(0.8)">
              <RaccoonShapes />
            </g>
          </g>
        </svg>
      </Tappable>
    </span>
  )
}

// Fixed specks rather than random ones, so the dust doesn't rearrange
// itself on every render.
const SPECKS = [
  [22, 30, 1.6],
  [70, 18, 1.2],
  [84, 52, 1.8],
  [40, 76, 1.4],
  [62, 64, 1],
  [16, 58, 1.1],
  [52, 40, 0.9],
  [78, 82, 1.3],
  [30, 14, 1],
  [90, 34, 0.8],
] as const

/** Away a fortnight or more: dust on the wheel, until it next turns. */
export function WheelDust() {
  return (
    <svg className="amb-dust" viewBox="0 0 100 100" aria-hidden="true">
      {SPECKS.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
      <path d="M24 88 Q50 80 78 90" className="amb-dust-film" />
    </svg>
  )
}

/**
 * What the result modal does when a film earns it. Sits in the corner of
 * the result where the bowl sits otherwise; most films get the bowl,
 * still, and nothing else.
 */
export function ReactionMoment({ reaction }: { reaction: Reaction | null }) {
  const uid = useUid()
  const still = prefersReducedMotion()
  const moving = (name: string) => (still ? '' : ` ${name}`)

  if (reaction === 'flip') {
    // Out of the water, over, and back in. Still: caught mid-air.
    return (
      <Tappable who="goldfish" className="modal-bowl">
        <svg className="moment amb-react" viewBox="0 -40 100 140" aria-hidden="true">
          <BowlShapes uid={uid} empty />
          <g className={`amb-flip-fish${moving('amb-flip-go')}`}>
            <g transform="translate(26 -30) scale(0.5)">
              <GoldfishShapes />
            </g>
          </g>
        </svg>
      </Tappable>
    )
  }

  if (reaction === 'hide') {
    // Behind the bowl: the glass in front, only a tail showing past it.
    return (
      <Tappable who="goldfish" className="modal-bowl">
        <svg className="moment amb-react" viewBox="0 0 112 100" aria-hidden="true">
          {/* Facing left, body behind the glass, tail out past its edge. */}
          <g className={`amb-hide-fish${moving('amb-hide-go')}`}>
            <g transform="translate(108 52) scale(-0.5 0.5)">
              <GoldfishShapes />
            </g>
          </g>
          <BowlShapes uid={uid} empty />
        </svg>
      </Tappable>
    )
  }

  if (reaction === 'back') {
    return (
      <Tappable who="raccoon" className="modal-bowl">
        <svg
          className={`moment amb-react${moving('amb-turn-away')}`}
          viewBox={RACCOON.viewBox}
          aria-hidden="true"
        >
          <RaccoonBackShapes />
        </svg>
      </Tappable>
    )
  }

  if (reaction === 'eyebrow') {
    return (
      <Tappable who="raccoon" className="modal-bowl">
        <svg
          className={`moment amb-react${moving('amb-brow-lift')}`}
          viewBox={RACCOON.viewBox}
          aria-hidden="true"
        >
          <RaccoonShapes brow />
        </svg>
      </Tappable>
    )
  }

  // Nothing to say about this one: the bowl, still.
  return (
    <Tappable who="goldfish" className="modal-bowl">
      <svg className="moment amb-react" viewBox={BOWL.viewBox} aria-hidden="true">
        <BowlShapes uid={uid} />
      </svg>
    </Tappable>
  )
}
