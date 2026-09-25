import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { BRAND } from './paths'
import { BowlShapes, RaccoonSeatedShapes } from './mark'
import { prefersReducedMotion } from './coldStart'
import { chooseScene, isForcing, nextInTurn, readHistory, writeHistory } from './idleScenes'
import { useCharacterRoom } from '../ui/characterRoom'
import type { IdleScene as SceneName } from './idleScenes'

/**
 * The two of them side by side, seated raccoon on the left and the bowl
 * on the right with the fish facing her. This is the resting pose; a
 * scene plays over it once and ends back in it.
 *
 * The scene is a class on the svg. Every movement is CSS on groups that
 * are already here, plus a few props (a blanket, a cloth, bubbles) that
 * are invisible at rest.
 */

// How long each runs, to match its keyframes, so the scene can be taken
// off once it has finished rather than left holding its last frame.
const DURATION_MS: Record<SceneName, number> = {
  'high-five': 3000,
  blanket: 3600,
  sway: 3600,
  polish: 4000,
  yawn: 3600,
  'look-off': 3400,
  splash: 3200,
  sulk: 4000,
  bubbles: 4000,
  doze: 3800,
}

// A beat after the screen settles, so a scene never starts in the same
// moment the screen appears.
const START_AFTER_MS = 1400

export function PairScene({ scene, playing }: { scene: SceneName | null; playing: boolean }) {
  const uid = useId().replace(/:/g, '')
  const on = playing && scene !== null
  return (
    <svg
      className={`pair-scene${on ? ` is-playing scene-${scene}` : ''}`}
      viewBox="0 -14 232 160"
      aria-hidden="true"
    >
      {/* Behind everything: the blanket is under her arms and over her lap. */}
      <g className="sc-raccoon">
        <RaccoonSeatedShapes />
        {/* Her yawn, over the snout. */}
        <ellipse
          className="sc-prop sc-yawn-raccoon"
          cx="60"
          cy="58.5"
          rx="3.6"
          ry="4.8"
          fill={BRAND.mask}
        />
      </g>

      {/* Mirrored, so the fish faces her. */}
      <g className="sc-bowl">
        <g transform="translate(212 58) scale(-0.82 0.82)">
          <BowlShapes uid={`pair-${uid}`} fishEye={on && scene === 'polish' ? 'closed' : 'open'} />
        </g>
      </g>

      {/* ---- Props, invisible at rest ---- */}

      {/* The fish's yawn: two seconds after hers. */}
      <ellipse
        className="sc-prop sc-yawn-fish"
        cx="149"
        cy="113"
        rx="3.6"
        ry="4.4"
        fill="#5a1d0a"
      />

      {/* Where paw meets fin. Placed outside, animated inside: a CSS
          transform replaces the transform attribute rather than adding to it. */}
      <g transform="translate(140 70)">
        <g className="sc-prop sc-burst">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="0"
              y1="-5"
              x2="0"
              y2="-11"
              stroke={BRAND.amber}
              strokeWidth="2.4"
              strokeLinecap="round"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      </g>

      {/* The blanket: dragged in from the left, most of it hers. */}
      <g className="sc-prop sc-blanket">
        <path d="M-6 92 Q70 80 176 104 L176 146 L-6 146 Z" fill={BRAND.rust} />
        <path
          d="M-6 104 Q70 92 176 116"
          stroke={BRAND.sand}
          strokeWidth="3"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M-6 118 Q70 106 176 130"
          stroke={BRAND.sand}
          strokeWidth="3"
          fill="none"
          opacity="0.7"
        />
      </g>

      {/* The cloth, and the gleam it leaves. */}
      <ellipse className="sc-prop sc-cloth" cx="164" cy="104" rx="9" ry="6.5" fill={BRAND.sand} />
      <path
        className="sc-prop sc-gleam"
        d="M150 96 L166 82"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* Water, flicked at her. */}
      <g className="sc-prop sc-drops" fill="rgba(160, 175, 220, 0.9)">
        <circle cx="160" cy="80" r="2.6" />
        <circle cx="166" cy="76" r="2" />
        <circle cx="154" cy="78" r="1.8" />
      </g>

      {/* Three bubbles; she gets the last. */}
      <g
        className="sc-prop-bubbles"
        fill="none"
        stroke="rgba(220, 230, 245, 0.85)"
        strokeWidth="1.6"
      >
        <circle className="sc-bubble sc-bubble-1" cx="152" cy="104" r="3" />
        <circle className="sc-bubble sc-bubble-2" cx="152" cy="104" r="3.6" />
        <circle className="sc-bubble sc-bubble-3" cx="152" cy="104" r="4.2" />
      </g>
    </svg>
  )
}

/**
 * The pair, on a screen with room, playing a scene roughly one visit in
 * five. Otherwise the screen's own character stays.
 *
 * `busy` is anything that has the person mid-task — loading, saving, or
 * waiting on them. A scene only starts when nothing is, and stops the
 * moment something is. A focused field counts as busy too.
 */
export function IdleScene({ busy, fallback }: { busy: boolean; fallback: ReactNode }) {
  // Decided once per visit. Pure here: the record is written when the
  // scene actually starts, so StrictMode's double call can't skew it.
  const [scene] = useState<SceneName | null>(() =>
    isForcing() ? nextInTurn(readHistory().lastScene) : chooseScene(readHistory(), Math.random),
  )
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(false)
  const still = prefersReducedMotion()
  // Hidden for want of room counts as not now: a scene nobody can see
  // would be spent for nothing.
  const room = useCharacterRoom()
  const waiting = busy || !room

  // Every eligible visit counts, played or not: it is what "never twice
  // in a row" is measured in.
  useEffect(() => {
    if (scene === null) writeHistory({ ...readHistory(), lastVisitPlayed: false })
  }, [scene])

  // Start once, after a beat, only while nothing is going on.
  useEffect(() => {
    if (scene === null || still || done || playing || waiting) return
    const timer = window.setTimeout(() => {
      const field = document.activeElement
      if (field && field.matches('input, textarea, select')) return
      writeHistory({ lastVisitPlayed: true, lastScene: scene })
      setPlaying(true)
    }, START_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [scene, still, done, playing, waiting])

  // Once through and stopped, back to the resting pose.
  useEffect(() => {
    if (!playing || scene === null) return
    const timer = window.setTimeout(() => {
      setPlaying(false)
      setDone(true)
    }, DURATION_MS[scene])
    return () => window.clearTimeout(timer)
  }, [playing, scene])

  // Something started mid-scene: stop at once and don't come back to it.
  if (playing && waiting) {
    setPlaying(false)
    setDone(true)
  }

  if (scene === null) return <>{fallback}</>
  return (
    <div className="character character-center">
      <PairScene scene={scene} playing={playing} />
    </div>
  )
}
