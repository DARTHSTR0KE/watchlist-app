import { useState } from 'react'
import type { ReactNode } from 'react'

interface OnboardingProps {
  // Read from profiles.display_name and passed down, never written into
  // the copy: change the name in the database and this changes with it.
  partnerName: string | null
  // Both finishing and skipping end it for good.
  onDone: () => void
  onGoToImport: () => void
}

interface Step {
  title: string
  body: ReactNode
  // An optional way to act on the step rather than just read it.
  action?: { label: string; kind: 'import' }
}

/**
 * Written for someone who has never seen the app and doesn't know what a
 * watchlist export is. No jargon that isn't explained in the same
 * sentence, and nothing that assumes a Letterboxd account already open.
 *
 * Built per render rather than declared as a constant because the other
 * person's name belongs in it, and that name is only known at runtime.
 */
function buildSteps(partnerName: string | null): Step[] {
  // An account with nobody linked yet still has to read as English.
  const them = partnerName ?? 'the other person'
  const bothOfYou = partnerName ? `you and ${partnerName}` : 'the two of you'

  return [
    {
      title: 'It picks the film',
      body: (
        <>
          <p>
            This is the wheel. It fills with films from your watchlist, you spin it, and it decides.
            That's the whole idea.
          </p>
          <p>No more twenty minutes of scrolling and then watching nothing.</p>
        </>
      ),
    },
    {
      title: 'First, fill it up',
      body: (
        <>
          <p>
            Right now the wheel is empty. Go to <strong>Settings</strong> and tap{' '}
            <strong>Import a watchlist</strong> — there's a link there that takes you straight to
            Letterboxd's export page.
          </p>
          <p>
            Download the zip it gives you, come back, and hand that zip to this app. Your watchlist,
            everything you've watched and all your ratings come across in one go.
          </p>
          <p>You don't need to unzip it or know what's inside.</p>
        </>
      ),
      action: { label: 'Take me there', kind: 'import' },
    },
    {
      title: 'Narrow it down',
      body: (
        <>
          <p>
            Filters sit above the wheel. Only in the mood for something Malayalam? Under two hours?
            Nothing scary tonight?
          </p>
          <p>Set it and the wheel only draws from what's left.</p>
        </>
      ),
    },
    {
      title: 'Passing films to each other',
      body: (
        <>
          <p>
            <strong>For me</strong> is where anything {them} sends you turns up, with a line about
            why they thought of it. You can send them back the same way.
          </p>
          <p>
            And <strong>Together</strong> is for the ones you're saving to watch with each other.
          </p>
        </>
      ),
    },
    {
      title: "The stats Letterboxd won't give you",
      body: (
        <>
          <p>
            Letterboxd shows you numbers once a year and charges for the good ones. These are here
            whenever you want them.
          </p>
          <p>
            What you actually watch, which decades, how you rate things, and the films {bothOfYou}{' '}
            disagree about most.
          </p>
        </>
      ),
    },
  ]
}

export function Onboarding({ partnerName, onDone, onGoToImport }: OnboardingProps) {
  const [index, setIndex] = useState(0)
  const steps = buildSteps(partnerName)
  const step = steps[index]
  const isLast = index === steps.length - 1

  return (
    <div className="onboard-overlay">
      <div className="onboard-card">
        <div className="onboard-progress" aria-label={`Step ${index + 1} of ${steps.length}`}>
          {steps.map((entry, i) => (
            <span
              key={entry.title}
              className={`onboard-dot${i === index ? ' onboard-dot-on' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>

        <h2 className="onboard-title">{step.title}</h2>
        <div className="onboard-body">{step.body}</div>

        <div className="onboard-actions">
          {step.action?.kind === 'import' && (
            <button type="button" className="action-button primary" onClick={onGoToImport}>
              {step.action.label}
            </button>
          )}
          <button
            type="button"
            className={`action-button${step.action ? '' : ' primary'}`}
            onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}
          >
            {isLast ? 'Go spin something' : 'Next'}
          </button>
          <div className="onboard-footer">
            {index > 0 && (
              <button type="button" className="onboard-quiet" onClick={() => setIndex((i) => i - 1)}>
                Back
              </button>
            )}
            {/* Skipping is final, same as finishing — settings has the way
                back in. Present on every step, including the last. */}
            <button type="button" className="onboard-quiet" onClick={onDone}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
