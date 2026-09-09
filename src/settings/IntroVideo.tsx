import { useState } from 'react'

// Drop a file here to make "Play intro" play something. Nothing in the
// repo ships one, so until a file exists at this path the player says so
// rather than showing a broken frame.
export const INTRO_VIDEO_SRC = '/intro.mp4'

export function IntroVideo({ onClose }: { onClose: () => void }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div className="filter-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="filter-sheet-header">
          <h2 className="filter-sheet-title">Intro</h2>
        </div>

        {failed ? (
          <p className="preset-empty">
            There's no intro video yet. Once one is added at <code>{INTRO_VIDEO_SRC}</code> it will
            play here.
          </p>
        ) : (
          <video
            className="intro-video"
            src={INTRO_VIDEO_SRC}
            controls
            autoPlay
            playsInline
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
