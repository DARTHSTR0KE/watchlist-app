import { RaccoonSeatedShapes, BowlShapes } from '../brand/mark'
import { SplashLineEditor } from './SplashLineEditor'
import { recordPromptSkipped } from './splashLines'
import type { SplashLine } from './splashLines'

/**
 * Asked on opening, before anything else, while I have never written a
 * line for them. Drawn as the splash itself, standing still, with the
 * field where the tagline sits — so what gets written is seen exactly
 * where it will land.
 */
export function SplashLinePrompt({
  userId,
  partnerId,
  partnerName,
  current,
  onDone,
}: {
  userId: string
  partnerId: string
  partnerName: string | null
  current: SplashLine | null
  // Saved or skipped; either way the prompt is finished.
  onDone: (saved: SplashLine | null) => void
}) {
  const them = partnerName ?? 'they'

  return (
    <div className="splash splash-still line-prompt" role="dialog" aria-label="Write their line">
      <p className="line-prompt-question">What should {them} see when they open this?</p>

      <div className="splash-stage">
        <svg className="splash-scene" viewBox="0 0 190 150" aria-hidden="true">
          <g className="sp-troupe">
            <g className="sp-raccoon">
              <RaccoonSeatedShapes />
            </g>
            <g className="sp-bowl">
              <g transform="translate(112 78) scale(0.66)">
                <BowlShapes uid="line-prompt" swimming />
              </g>
            </g>
          </g>
        </svg>
      </div>

      <div className="splash-words">
        <p className="splash-name">Chhobidam</p>
        <p className="splash-gloss">chhobi + padam</p>
        <SplashLineEditor
          userId={userId}
          partnerId={partnerId}
          current={current}
          variant="splash"
          onSaved={(saved) => onDone(saved)}
          secondary={
            <button
              type="button"
              className="line-skip"
              onClick={() => {
                // Asks again next month, not next open.
                recordPromptSkipped()
                onDone(null)
              }}
            >
              Not now
            </button>
          }
        />
      </div>
    </div>
  )
}
