import { useState } from 'react'
import { PairScene } from '../brand/PairScene'
import { prefersReducedMotion } from '../brand/coldStart'
import { IDLE_SCENES, isForcing, setForcing } from '../brand/idleScenes'
import type { IdleScene } from '../brand/idleScenes'
import { SectionLabel } from '../ui/Screen'

/**
 * TEMPORARY. Plays any of the ten idle scenes on the spot, and can make
 * every visit to Settings, Watched, Together and For me play the next one
 * in turn. Comes out once all ten have been seen.
 */
export function SceneCheck() {
  const [scene, setScene] = useState<IdleScene | null>(null)
  // Bumped on every tap, so the same scene can be played again.
  const [take, setTake] = useState(0)
  const [forcing, setForcingState] = useState(isForcing)
  const still = prefersReducedMotion()

  return (
    <section>
      <SectionLabel>Idle scenes (temporary)</SectionLabel>
      {still && (
        <p className="filter-hint">
          This device asks for reduced motion, so the scenes hold still. On Android that is
          Settings › Accessibility › Remove animations.
        </p>
      )}
      <div className="scene-check-stage">
        <PairScene key={take} scene={scene} playing={scene !== null} />
      </div>
      <div className="scene-check-grid">
        {IDLE_SCENES.map((name) => (
          <button
            key={name}
            type="button"
            className="btn-field"
            onClick={() => {
              setScene(name)
              setTake((current) => current + 1)
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <label className="filter-toggle">
        <input
          type="checkbox"
          checked={forcing}
          onChange={() => {
            setForcing(!forcing)
            setForcingState(!forcing)
          }}
        />
        Play one on every visit, the next each time
      </label>
    </section>
  )
}
