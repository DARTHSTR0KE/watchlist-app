import { useState } from 'react'
import { INTRO_BUCKET, INTRO_OBJECT, introVideoUrl } from './introSource'

export function IntroVideo({ onClose }: { onClose: () => void }) {
  const [failed, setFailed] = useState(false)
  const src = introVideoUrl()

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">Intro</h2>
        </div>

        {failed ? (
          <p className="preset-empty">
            The intro couldn't be loaded. It's expected at <code>{INTRO_OBJECT}</code> in the{' '}
            <code>{INTRO_BUCKET}</code> bucket, which needs to exist and be public.
          </p>
        ) : (
          <video
            className="intro-video"
            src={src}
            controls
            autoPlay
            playsInline
            // Nothing is fetched until Play intro is tapped, and this
            // keeps it that way if a browser ever renders it early.
            preload="none"
            onError={() => setFailed(true)}
          />
        )}

        <div className="filter-sheet-actions">
          <button type="button" className="action-button primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
