import { useEffect, useRef } from 'react'
import {
  BowlShapes,
  GoldfishShapes,
  MoonShapes,
  RaccoonShapes,
  RaccoonSeatedShapes,
  ZzzShapes,
} from './mark'
import { useSplashAmbient } from './useSplashAmbient'
import { prefersReducedMotion } from './coldStart'
import { SpeechBubble } from './SpeechBubble'
import { SPOKEN_MIN_VISIBLE_MS, useSpokenNudge } from './useSpokenNudge'
import { useLineForMe } from './useLineForMe'

/**
 * One raccoon and one goldfish in its bowl, from the first frame to the
 * last. Nothing crossfades into anything and no drawing is swapped for
 * another version of itself partway through.
 *
 * The whole thing runs off a single five-second clock: every element gets
 * the same duration and differs only in which percentages it moves at, so
 * the reach, the lift, the walk and the text can't drift apart the way
 * separate timers would.
 *
 *   0.0-0.8  the pair fade in, already in position
 *   0.8-1.4  the name and the gloss fade in
 *   1.0      the skip hint appears
 *   1.4-2.0  the tagline fades in, and holds — sixty characters need reading time
 *   3.8-4.25 she walks over to the bowl
 *   4.25-4.45 she bends to it and reaches down with both arms
 *   4.45-4.6 she lifts it to her chest, the water staying level
 *   4.6-5.0  she straightens and walks off right with it
 *
 * The bowl holds identity until the frame she has hold of it, so it is
 * standing still for every frame before that — she goes to it, rather
 * than it coming to her.
 *
 * It renders over the app, which is already mounted and loading
 * underneath, so nothing waits on it and there is no blank frame when it
 * clears.
 */
const FULL_MS = 5000

// When the bubble comes up, and so when its own clock can start.
const BUBBLE_AT_MS = 1400

// Long enough to take the composed picture in, and then out of the way.
const STILL_MS = 1500

/**
 * With something to read in the still frame, 1.5s is the time the bubble
 * needs on its own — leaving at exactly that moment would race the timer
 * that marks it delivered, and lose the message half the time. The still
 * holds a little longer when there is a bubble in it, and only then.
 */
const STILL_WITH_BUBBLE_MS = STILL_MS + SPOKEN_MIN_VISIBLE_MS

export function Splash({ onDone }: { onDone: () => void }) {
  const reduced = prefersReducedMotion()
  const { spoken, onVisible } = useSpokenNudge()
  const visibleRef = useRef(false)
  // Written for me by the other person; neither of us writes our own.
  const tagline = useLineForMe()
  // What the hour, the weather and the two of you add. Never waited on.
  const ambient = useSplashAmbient()

  useEffect(() => {
    const hold = reduced ? (spoken ? STILL_WITH_BUBBLE_MS : STILL_MS) : FULL_MS
    const t = window.setTimeout(onDone, hold)
    return () => window.clearTimeout(t)
  }, [onDone, reduced, spoken])

  // The bubble's clock starts when it is on screen, not when the splash
  // mounted — a nudge that arrives late gets its full reading time or none
  // at all, and never a partial one that counts as delivered.
  useEffect(() => {
    if (!spoken || visibleRef.current) return
    if (reduced) {
      visibleRef.current = true
      onVisible()
      return
    }
    const t = window.setTimeout(() => {
      visibleRef.current = true
      onVisible()
    }, BUBBLE_AT_MS)
    return () => window.clearTimeout(t)
  }, [spoken, reduced, onVisible])

  return (
    <div
      className={`splash${reduced ? ' splash-still' : ''}${ambient.asleep ? ' splash-asleep' : ''}${ambient.together ? ' splash-together' : ''}`}
      onPointerDown={onDone}
      role="presentation"
    >
      {/* Above the speaker's head, in step with the tagline: up when it
          comes up, gone when it goes. */}
      {spoken && (
        <div className={`splash-speech${reduced ? ' splash-speech-still' : ''}`}>
          <SpeechBubble text={spoken.nudge.message} />
          <svg
            className="splash-speaker"
            viewBox={spoken.speaker === 'goldfish' ? '0 0 100 64' : '0 0 100 100'}
            aria-hidden="true"
          >
            {spoken.speaker === 'goldfish' ? <GoldfishShapes /> : <RaccoonShapes />}
          </svg>
        </div>
      )}

      <div className="splash-stage">
        <svg className="splash-scene" viewBox="0 0 190 150" aria-hidden="true">
          {/* Two independent actors on one clock. The bowl is not inside
              anything that moves — it is on the ground where it was put. */}
          <g className="sp-troupe">
            <g className="sp-raccoon">
              <RaccoonSeatedShapes eyes={ambient.asleep ? 'closed' : 'open'} />
            </g>
            {/* Placement inside, animation outside — a CSS transform
                replaces the attribute rather than composing with it.
                She picks up the bowl, not the fish: the fish is swimming
                in it from the first frame and never leaves it. */}
            <g className="sp-bowl">
              <g transform="translate(112 78) scale(0.66)">
                <BowlShapes
                  uid="splash"
                  swimming={!ambient.fishAsleep}
                  tired={ambient.fishTired}
                  fishEye={ambient.fishAsleep ? 'closed' : ambient.fishTired ? 'tired' : 'open'}
                />
              </g>
              {ambient.fishAsleep && (
                <g transform="translate(150 66)">
                  <ZzzShapes />
                </g>
              )}
            </g>
            {ambient.asleep && (
              <g transform="translate(96 8)">
                <ZzzShapes />
              </g>
            )}
          </g>
          {/* Past midnight: she's up, and there's a moon to be up under. */}
          {ambient.moon && (
            <g className="sp-moon" transform="translate(158 2) scale(0.22)">
              <MoonShapes />
            </g>
          )}
        </svg>
      </div>

      {/* Fades where it stands. Nothing here moves sideways, which is what
          was clipping it mid-word against the edge of the screen. */}
      <div className="splash-words">
        <p className="splash-name">Chhobidam</p>
        <p className="splash-gloss">chhobi + padam</p>
        <p className="splash-tag">{tagline}</p>
        {/* Beneath their line, never instead of it, and usually absent. */}
        {ambient.aside && <p className="splash-aside">{ambient.aside}</p>}
      </div>

      {/* Five seconds is long enough that it needs saying. */}
      <p className="splash-hint">tap to skip</p>
    </div>
  )
}
