import { useEffect, useRef, useState } from 'react'
import { introVideoUrl } from '../settings/introSource'

interface BirthdayVideoProps {
  // True only for the automatic play. The settings button passes false, so
  // replaying can never use up the real day.
  recordPlayed: boolean
  onPlayed: () => void
  onClose: () => void
}

// If it hasn't reached a playable state by now, give up. It must never be
// the thing standing between someone and their app.
const READY_TIMEOUT_MS = 2000

type Phase = 'loading' | 'ready' | 'playing'

export function BirthdayVideo({ recordPlayed, onPlayed, onClose }: BirthdayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [muted, setMuted] = useState(false)
  const [soundRefused, setSoundRefused] = useState(false)

  // A slow or broken load is abandoned rather than left hanging. This is
  // deliberately not recorded as played: a failure should be retried on a
  // later open, where a real play or a deliberate skip should not.
  useEffect(() => {
    if (phase !== 'loading') return
    const timer = window.setTimeout(onClose, READY_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
    // onClose is stable for the life of this overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const finish = () => {
    if (recordPlayed) onPlayed()
    onClose()
  }

  /**
   * Sound only ever arrives through a deliberate tap — browsers refuse to
   * autoplay audio, and rightly. If they refuse anyway, play muted with a
   * way to turn it on rather than not playing at all.
   */
  const start = async () => {
    const video = videoRef.current
    if (!video) return
    video.muted = false
    try {
      await video.play()
      setPhase('playing')
    } catch {
      video.muted = true
      setMuted(true)
      setSoundRefused(true)
      try {
        await video.play()
        setPhase('playing')
      } catch {
        onClose()
      }
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    setMuted(next)
    if (!next) setSoundRefused(false)
  }

  return (
    <div className="birthday-screen">
      <video
        ref={videoRef}
        className="birthday-video"
        src={introVideoUrl()}
        playsInline
        // Metadata alone paints the first frame, which is the poster the
        // play control sits on. Nothing streams until it is asked for.
        preload="metadata"
        onLoadedMetadata={() => setPhase((p) => (p === 'loading' ? 'ready' : p))}
        onError={onClose}
        onEnded={finish}
      />

      {phase !== 'playing' && (
        <button
          type="button"
          className="birthday-play"
          disabled={phase === 'loading'}
          onClick={() => void start()}
          aria-label="Play with sound"
        >
          <span className="birthday-play-mark" aria-hidden="true" />
        </button>
      )}

      <div className="birthday-controls">
        {soundRefused && phase === 'playing' && (
          <p className="birthday-note">Your browser blocked the sound.</p>
        )}
        {phase === 'playing' && (
          <button type="button" className="birthday-control" onClick={toggleMute}>
            {muted ? 'Sound on' : 'Mute'}
          </button>
        )}
        {/* Available from the first second, not after some grace period. */}
        {phase !== 'loading' && (
          <button type="button" className="birthday-control" onClick={finish}>
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
