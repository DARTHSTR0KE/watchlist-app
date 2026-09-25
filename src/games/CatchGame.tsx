import { useEffect, useRef, useState } from 'react'
import { RaccoonSeatedShapes } from '../brand/mark'
import { prefersReducedMotion } from '../brand/coldStart'
import { buildPosterUrl } from '../wheel/posters'
import {
  CATCH_MAX_FALLING,
  LIVES,
  catchFallRate,
  catchSpawnMs,
  catchWatchedChance,
} from './gameRules'
import type { GamePool, PosterFilm } from './gameRules'

/**
 * The raccoon at the bottom, following a finger. Posters fall; one I
 * haven't watched is a point, one I have is a life.
 *
 * Kept light for a phone: a fixed set of six poster slots made once and
 * reused, moved with transforms from one animation loop, and React only
 * re-rendering when the score or lives change — never per frame.
 */

const POSTER_W = 58
const POSTER_H = 87
const RACCOON_W = 84
const RACCOON_H = 98
// How far either side of her middle a poster still counts as caught.
const REACH = RACCOON_W / 2 + POSTER_W * 0.3
// Her paws, measured down from the top of her box.
const PAWS_Y = 30

interface Falling {
  slot: number
  film: PosterFilm
  watched: boolean
  x: number
  y: number
}

export function CatchGame({ pool, onOver }: { pool: GamePool; onOver: (score: number) => void }) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const raccoonRef = useRef<HTMLDivElement | null>(null)
  const slotRefs = useRef<(HTMLDivElement | null)[]>([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES)
  const [started, setStarted] = useState(false)
  // Brief reactions on her, and only when motion is welcome.
  const [flash, setFlash] = useState<'caught' | 'hurt' | null>(null)
  const still = prefersReducedMotion()
  const onOverRef = useRef(onOver)
  useEffect(() => {
    onOverRef.current = onOver
  }, [onOver])

  // Where the finger is, as her middle, in field pixels.
  const targetX = useRef<number | null>(null)

  // Standing in the middle until a finger says otherwise.
  useEffect(() => {
    const field = fieldRef.current
    const raccoon = raccoonRef.current
    if (field && raccoon) {
      raccoon.style.transform = `translate3d(${field.clientWidth / 2 - RACCOON_W / 2}px, 0, 0)`
    }
  }, [])

  useEffect(() => {
    const field = fieldRef.current
    if (!field) return
    const follow = (event: PointerEvent) => {
      const box = field.getBoundingClientRect()
      targetX.current = event.clientX - box.left
    }
    field.addEventListener('pointerdown', follow)
    field.addEventListener('pointermove', follow)
    return () => {
      field.removeEventListener('pointerdown', follow)
      field.removeEventListener('pointermove', follow)
    }
  }, [])

  useEffect(() => {
    if (!started) return
    const field = fieldRef.current
    const raccoon = raccoonRef.current
    if (!field || !raccoon) return

    let width = field.clientWidth
    let height = field.clientHeight
    const resize = new ResizeObserver(() => {
      width = field.clientWidth
      height = field.clientHeight
    })
    resize.observe(field)

    let x = targetX.current ?? width / 2
    let points = 0
    let left = LIVES
    let sinceSpawn = 0
    let last = performance.now()
    let frame = 0
    let over = false
    const falling: Falling[] = []
    const free = Array.from({ length: CATCH_MAX_FALLING }, (_, index) => index)
    let flashTimer = 0

    const show = (kind: 'caught' | 'hurt') => {
      if (still) return
      window.clearTimeout(flashTimer)
      setFlash(kind)
      flashTimer = window.setTimeout(() => setFlash(null), 260)
    }

    const release = (item: Falling) => {
      const el = slotRefs.current[item.slot]
      if (el) el.style.visibility = 'hidden'
      free.push(item.slot)
    }

    const spawn = () => {
      const slot = free.pop()
      if (slot === undefined) return
      const watched = Math.random() < catchWatchedChance(points)
      const list = watched ? pool.watched : pool.safe
      const film = list[Math.floor(Math.random() * list.length)]
      const item: Falling = {
        slot,
        film,
        watched,
        x: Math.random() * Math.max(0, width - POSTER_W),
        y: -POSTER_H,
      }
      const el = slotRefs.current[slot]
      if (el) {
        const image = el.firstElementChild as HTMLImageElement
        image.src = buildPosterUrl(film.posterPath) ?? ''
        el.classList.toggle('catch-watched', watched)
        el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`
        el.style.visibility = 'visible'
      }
      falling.push(item)
    }

    const step = (now: number) => {
      if (over) return
      // A long gap (a notification, a stall) isn't allowed to teleport
      // everything down the screen.
      const dt = Math.min(50, now - last) / 1000
      last = now

      if (targetX.current !== null) x = targetX.current
      x = Math.max(RACCOON_W / 2, Math.min(width - RACCOON_W / 2, x))
      raccoon.style.transform = `translate3d(${x - RACCOON_W / 2}px, 0, 0)`

      sinceSpawn += dt * 1000
      if (sinceSpawn >= catchSpawnMs(points) && falling.length < CATCH_MAX_FALLING) {
        sinceSpawn = 0
        spawn()
      }

      const pawsY = height - RACCOON_H + PAWS_Y
      const speed = catchFallRate(points) * height
      for (let index = falling.length - 1; index >= 0; index--) {
        const item = falling[index]
        const before = item.y + POSTER_H
        item.y += speed * dt
        const after = item.y + POSTER_H
        const centre = item.x + POSTER_W / 2
        if (before < pawsY && after >= pawsY && Math.abs(centre - x) <= REACH) {
          falling.splice(index, 1)
          release(item)
          if (item.watched) {
            left -= 1
            setLives(left)
            show('hurt')
            if (left <= 0) {
              over = true
              onOverRef.current(points)
              return
            }
          } else {
            points += 1
            setScore(points)
            show('caught')
          }
          continue
        }
        if (item.y > height) {
          // Missed: no cost either way.
          falling.splice(index, 1)
          release(item)
          continue
        }
        const el = slotRefs.current[item.slot]
        if (el) el.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`
      }
      frame = requestAnimationFrame(step)
    }

    // Hidden, the loop stops; back, it picks up without a jump.
    const visibility = () => {
      if (document.visibilityState === 'visible' && !over) {
        last = performance.now()
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(step)
      } else {
        cancelAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', visibility)
    frame = requestAnimationFrame(step)

    return () => {
      over = true
      cancelAnimationFrame(frame)
      window.clearTimeout(flashTimer)
      resize.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [started, pool, still])

  return (
    <div className="catch">
      <div className="game-hud">
        <span className="game-score">{score}</span>
        <span className="game-lives" aria-label={`${lives} lives left`}>
          {Array.from({ length: LIVES }, (_, index) => (
            <span key={index} className={index < lives ? 'life' : 'life life-lost'} aria-hidden="true">
              ♥
            </span>
          ))}
        </span>
      </div>
      <div className="catch-field" ref={fieldRef}>
        {Array.from({ length: CATCH_MAX_FALLING }, (_, index) => (
          <div
            key={index}
            className="catch-poster"
            ref={(el) => {
              slotRefs.current[index] = el
            }}
          >
            <img alt="" draggable={false} />
            <span className="catch-tick" aria-hidden="true">
              ✓
            </span>
          </div>
        ))}
        <div
          ref={raccoonRef}
          className={`catch-raccoon${flash ? ` catch-${flash}` : ''}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 120 140">
            <RaccoonSeatedShapes />
          </svg>
        </div>
        {!started && (
          <button type="button" className="game-start" onClick={() => setStarted(true)}>
            Tap to start
          </button>
        )}
      </div>
    </div>
  )
}
