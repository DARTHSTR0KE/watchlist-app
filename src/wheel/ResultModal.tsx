import { useState } from 'react'
import type { WheelItem } from './titles'
import { FilmSheet } from './FilmSheet'
import { ShrugMoment } from '../brand/Moments'
import { ReactionMoment } from '../brand/Ambient'
import type { Reaction } from '../ambient/ambient'

interface ResultModalProps {
  item: WheelItem
  // Null for most films: they get the bowl, still, and nothing else.
  reaction: Reaction | null
  rerollsRemaining: number
  canReroll: boolean
  canRemoveFromWheel: boolean
  reduceMotion: boolean
  // Empty outside the two shared sources. One each per spin session, so a
  // used one stays visible and disabled rather than disappearing. The label
  // is built by the caller, which is what knows whether the subject is
  // "you" or a name — the verb has to agree with it.
  vetoes: { key: string; label: string; used: boolean }[]
  onVeto: (key: string) => void
  onWatch: () => void
  onSpinAgain: () => void
  onTakeOff: () => void
  onReshuffle: () => void
  onDismiss: () => void
}

// 6pm–4am local -> "Not tonight", 4am–6pm -> "Not today".
function getTakeOffLabel(): string {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 4 ? 'Not tonight' : 'Not today'
}

// The wheel's own result: the shared film sheet with the three actions that
// only make sense after a spin.
export function ResultModal({
  item,
  reaction,
  rerollsRemaining,
  canReroll,
  canRemoveFromWheel,
  reduceMotion,
  vetoes,
  onVeto,
  onWatch,
  onSpinAgain,
  onTakeOff,
  onReshuffle,
  onDismiss,
}: ResultModalProps) {
  // Computed once per mount — the modal re-mounts fresh each time it opens
  // (result goes null then non-null again), so this re-evaluates every open
  // rather than staying fixed from whenever the app first started.
  const [takeOffLabel] = useState(getTakeOffLabel)

  return (
    <FilmSheet
      item={item}
      reduceMotion={reduceMotion}
      onDismiss={onDismiss}
      // In the corner of the result. Most films get the bowl and no more; a
      // few earn a reaction. Nothing waits on it.
      corner={<ReactionMoment reaction={reaction} />}
    >
      <button type="button" className="action-button primary" onClick={onWatch}>
        Watch this
      </button>
      <button
        type="button"
        className="action-button"
        onClick={onSpinAgain}
        disabled={!canReroll}
      >
        Spin again
      </button>
      {canRemoveFromWheel ? (
        <button type="button" className="action-button" onClick={onTakeOff}>
          {takeOffLabel}
        </button>
      ) : (
        <button type="button" className="action-button" onClick={onReshuffle}>
          Reshuffle
        </button>
      )}
      {vetoes.length > 0 && (
        <div className="veto-row">
          {vetoes.map((veto) => (
            <button
              key={veto.key}
              type="button"
              className="action-button veto-button"
              disabled={veto.used}
              onClick={() => onVeto(veto.key)}
            >
              {veto.label}
            </button>
          ))}
        </div>
      )}

      {canReroll ? (
        <p className="reroll-status">
          {rerollsRemaining} reroll{rerollsRemaining === 1 ? '' : 's'} remaining
        </p>
      ) : (
        /* Out of rerolls: a shrug, and the line it goes with. */
        <p className="reroll-status reroll-status-done">
          <ShrugMoment />
          <span>That's the one.</span>
        </p>
      )}
    </FilmSheet>
  )
}
