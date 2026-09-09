import { useState } from 'react'
import type { ReactNode } from 'react'

interface OnboardingProps {
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
 */
const STEPS: Step[] = [
  {
    title: 'It picks the film',
    body: (
      <>
        <p>
          You know the hour you lose scrolling, reading the same descriptions, and going to bed
          without watching anything? This is for that.
        </p>
        <p>
          You put the films you mean to watch on a list. The app spins a wheel and picks one. You
          watch it.
        </p>
      </>
    ),
  },
  {
    title: 'Fill the wheel',
    body: (
      <>
        <p>
          The wheel needs something to choose between, so the first job is getting your films in.
        </p>
        <p>
          If you use Letterboxd, it can hand you a copy of your lists as a file. On the Letterboxd
          website go to <strong>Settings</strong>, then <strong>Data</strong>, then{' '}
          <strong>Export Your Data</strong>. It downloads one file ending in <code>.zip</code>.
        </p>
        <p>
          Bring that file here and the app reads your watchlist out of it. You don't need to unpack
          it or understand what's inside.
        </p>
      </>
    ),
    action: { label: 'Take me there', kind: 'import' },
  },
  {
    title: 'Spinning',
    body: (
      <>
        <p>Tap the middle of the wheel. It spins and stops on one film.</p>
        <p>Then you have three choices:</p>
        <ul className="onboard-list">
          <li>
            <strong>Watch this</strong> — you're going to watch it. It comes off your list.
          </li>
          <li>
            <strong>Spin again</strong> — not that one. You get two of these.
          </li>
          <li>
            <strong>Not tonight</strong> — sets it aside for this evening only. It's back next time.
          </li>
        </ul>
        <p>
          Filters narrow what the wheel can land on — only short films, say, or only things you
          haven't seen.
        </p>
      </>
    ),
  },
  {
    title: 'Passing films to each other',
    body: (
      <>
        <p>
          When you come across something the other person would like, send it over with a line about
          why you thought of them.
        </p>
        <p>
          It arrives on their screen with your note. They can put it on their own list or pass on it.
          Nothing is added to anyone's list without them saying so.
        </p>
      </>
    ),
  },
  {
    title: 'What you watched together',
    body: (
      <>
        <p>
          After you tap <strong>Watch this</strong>, the app says nothing else — you're about to
          start a film.
        </p>
        <p>
          The next time you open it, it asks one question: did you watch that together, on your own,
          or not in the end? If you didn't, it goes back on your list exactly as it was.
        </p>
        <p>Everything you answer "together" to collects on its own screen.</p>
      </>
    ),
  },
]

export function Onboarding({ onDone, onGoToImport }: OnboardingProps) {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  return (
    <div className="onboard-overlay">
      <div className="onboard-card">
        <div className="onboard-progress" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
          {STEPS.map((entry, i) => (
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
            {isLast ? 'Start' : 'Next'}
          </button>
          <div className="onboard-footer">
            {index > 0 && (
              <button type="button" className="onboard-quiet" onClick={() => setIndex((i) => i - 1)}>
                Back
              </button>
            )}
            {/* Skipping is final, same as finishing — settings has the way
                back in. */}
            <button type="button" className="onboard-quiet" onClick={onDone}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
