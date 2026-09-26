import { useCallback, useEffect, useState } from 'react'
import { PairScene } from '../brand/PairScene'
import { Empty, ErrorLine, Loading, Row, Rows, Screen, SectionLabel } from '../ui/Screen'
import { Ticket } from '../ui/Ticket'
import { DriftingGround } from '../ui/Ground'
import { TINT } from '../ui/posterColor'
import { describeError, reportQuietly } from '../lib/dbError'
import { agree, possessiveName, subjectName } from '../utils/names'
import {
  APP_OPENED_AT,
  answerTurn,
  drawForSession,
  loadTurns,
  markSeen,
  passTurn,
  photoUrl,
  reactToTurn,
  resetDeck,
  uploadPhoto,
} from './truthOrDare'
import {
  deckLabel,
  historyEntries,
  inWarmup,
  nextInPersonPlayer,
  openInPersonTurn,
  passesLeft,
  virtualState,
  waitingForMe,
} from './turnRules'
import type { Kind, Mode, Turn } from './turnRules'

interface TruthOrDareProps {
  userId: string
  partnerId: string | null
  partnerName: string | null
  // Back to the Games screen it was opened from.
  onBack: () => void
}

const REACTIONS = ['❤️', '😂', '😮', '🔥', '🥺']

// The database's reasons, in the app's voice. Anything else is said as it
// came, so a real fault is never hidden behind a friendly line.
function explain(error: unknown, partnerName: string | null): string {
  const text = describeError(error)
  if (text.includes('not your turn')) return `It's ${possessiveName(partnerName)} turn.`
  if (text.includes('finish the open turn first')) return 'There is already a card in play.'
  if (text.includes('no passes left this week')) return 'No passes left this week.'
  return text
}

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Truth or dare, from Together. Both characters sit at the top, since this
 * screen belongs to both of us.
 *
 * In person: one phone, passed between us, turns alternating. Virtual: I
 * draw and answer, it goes to them, they see it when they next open the
 * app, react, and take theirs. Virtual never deals a dare that needs the
 * same room; draw_card leaves those out on its own.
 */
export function TruthOrDareScreen({ userId, partnerId, partnerName, onBack }: TruthOrDareProps) {
  const [turns, setTurns] = useState<Turn[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)

  const refresh = useCallback(async () => {
    try {
      setTurns(await loadTurns())
      setFailure(null)
    } catch (error) {
      setFailure(describeError(error))
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void loadTurns()
      .then((rows) => {
        if (!cancelled) setTurns(rows)
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(describeError(error))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // They may take their turn while this is open in the background: look
  // again whenever the app comes back into view.
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [refresh])

  const choose = (next: Mode) => {
    setMode(next)
    void refresh()
  }

  const ground = <DriftingGround left={TINT.rust} right={TINT.mauve} />
  const back = (
    <button type="button" className="td-switch" onClick={onBack}>
      ‹ Games
    </button>
  )
  const pair = (
    <div className="td-pair" aria-hidden="true">
      <PairScene scene={null} playing={false} />
    </div>
  )

  if (!partnerId) {
    return (
      <Screen ground={ground}>
        {back}
        <Ticket heading="TRUTH OR DARE" figure="—" line="No partner is linked to this account" />
        {pair}
        <Empty>There is nobody to play with yet.</Empty>
      </Screen>
    )
  }

  if (failure && turns === null) {
    return (
      <Screen ground={ground}>
        {back}
        <Ticket heading="TRUTH OR DARE" figure="—" line="Couldn't load" />
        {pair}
        <ErrorLine>Couldn't load the game: {failure}</ErrorLine>
      </Screen>
    )
  }

  if (turns === null) {
    return (
      <Screen ground={ground}>
        {back}
        <Ticket heading="TRUTH OR DARE" figure="…" line="Shuffling" />
        {pair}
        <Loading />
      </Screen>
    )
  }

  const waiting = waitingForMe(turns, userId)
  const answered = turns.filter((turn) => turn.status !== 'open').length

  return (
    <Screen ground={ground}>
      {back}
      <Ticket
        heading="TRUTH OR DARE"
        figure={mode === null ? 'Two of you' : mode === 'in_person' ? 'In person' : 'Virtual'}
        line={`${answered} ${answered === 1 ? 'card' : 'cards'} played so far`}
      />
      {pair}

      {mode === null ? (
        <section>
          <SectionLabel tone="rust">How are you playing?</SectionLabel>
          {waiting.length > 0 && (
            <p className="td-note">
              {subjectName(partnerName, true)} {agree(partnerName, 'has', 'have')} taken a turn.
            </p>
          )}
          <Rows>
            <Row
              name="In person"
              meta="One phone, passed back and forth"
              onOpen={() => choose('in_person')}
            />
            <Row
              name="Virtual"
              meta="Take turns wherever you each are"
              onOpen={() => choose('virtual')}
            />
          </Rows>
        </section>
      ) : (
        <>
          <button type="button" className="td-switch" onClick={() => setMode(null)}>
            ‹ Change how you're playing
          </button>
          {mode === 'virtual' ? (
            <VirtualTable
              turns={turns}
              userId={userId}
              partnerName={partnerName}
              onChanged={refresh}
            />
          ) : (
            <InPersonTable
              turns={turns}
              userId={userId}
              partnerId={partnerId}
              partnerName={partnerName}
              onChanged={refresh}
            />
          )}
        </>
      )}

      <History turns={turns} userId={userId} partnerName={partnerName} />
    </Screen>
  )
}

/* ------------------------------------------------------------------ */
/* Virtual                                                             */
/* ------------------------------------------------------------------ */

function VirtualTable({
  turns,
  userId,
  partnerName,
  onChanged,
}: {
  turns: Turn[]
  userId: string
  partnerName: string | null
  onChanged: () => Promise<void>
}) {
  const waiting = waitingForMe(turns, userId)
  if (waiting.length > 0) {
    return <TheirTurn turn={waiting[0]} partnerName={partnerName} onDone={onChanged} />
  }

  const state = virtualState(turns, userId)
  if (state.kind === 'open') {
    return (
      <CardInPlay
        turn={state.turn}
        userId={userId}
        who={null}
        passes={passesLeft(turns, userId, new Date())}
        partnerName={partnerName}
        onDone={onChanged}
      />
    )
  }
  if (state.kind === 'their-turn') {
    return (
      <section className="td-waiting">
        <SectionLabel tone="rust">Over to {subjectName(partnerName)}</SectionLabel>
        <p className="td-note">
          {state.last.player === userId
            ? `Your ${state.last.kind} has gone to ${subjectName(partnerName)}. It's waiting for the next time the app is opened, and then it's ${possessiveName(partnerName)} turn.`
            : `${subjectName(partnerName, true)} ${agree(partnerName, 'is', 'are')} partway through a turn.`}
        </p>
      </section>
    )
  }
  return (
    <Draw
      mode="virtual"
      player={userId}
      heading="Your turn"
      warm={inWarmup(turns, 'virtual', userId, new Date(), APP_OPENED_AT)}
      partnerName={partnerName}
      onDrawn={onChanged}
    />
  )
}

// Their answered or passed turn, which I react to before taking mine.
function TheirTurn({
  turn,
  partnerName,
  onDone,
}: {
  turn: Turn
  partnerName: string | null
  onDone: () => Promise<void>
}) {
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const act = async (run: () => Promise<unknown>) => {
    setWorking(true)
    setProblem(null)
    try {
      await run()
      await onDone()
    } catch (error) {
      setProblem(explain(error, partnerName))
      setWorking(false)
    }
  }

  return (
    <section>
      <SectionLabel tone="rust">{possessiveName(partnerName)} turn</SectionLabel>
      <PlayingCard turn={turn} />
      <Answer turn={turn} />
      <p className="td-note">React, then it's your turn.</p>
      <div className="td-reactions">
        {REACTIONS.map((reaction) => (
          <button
            key={reaction}
            type="button"
            className="td-reaction"
            disabled={working}
            onClick={() => void act(() => reactToTurn(turn.id, reaction))}
            aria-label={`React with ${reaction}`}
          >
            {reaction}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn-field"
        disabled={working}
        onClick={() => void act(() => markSeen([turn.id]))}
      >
        Carry on without reacting
      </button>
      {problem && <p className="line-meta line-error">{problem}</p>}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* In person                                                           */
/* ------------------------------------------------------------------ */

function InPersonTable({
  turns,
  userId,
  partnerId,
  partnerName,
  onChanged,
}: {
  turns: Turn[]
  userId: string
  partnerId: string
  partnerName: string | null
  onChanged: () => Promise<void>
}) {
  const open = openInPersonTurn(turns, userId)
  if (open) {
    return (
      <CardInPlay
        turn={open}
        userId={userId}
        who={open.player === userId ? null : partnerName}
        passes={passesLeft(turns, open.player, new Date())}
        partnerName={partnerName}
        onDone={onChanged}
      />
    )
  }
  const next = nextInPersonPlayer(turns, userId, partnerId)
  const theirs = next !== userId
  return (
    <Draw
      mode="in_person"
      player={next}
      heading={theirs ? `${possessiveName(partnerName)} turn` : 'Your turn'}
      handOver={theirs ? `Pass the phone to ${subjectName(partnerName)}.` : null}
      warm={inWarmup(turns, 'in_person', userId, new Date(), APP_OPENED_AT)}
      partnerName={partnerName}
      onDrawn={onChanged}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function Draw({
  mode,
  player,
  heading,
  handOver = null,
  warm,
  partnerName,
  onDrawn,
}: {
  mode: Mode
  player: string
  heading: string
  handOver?: string | null
  // Still in the session's warm-up: no spicy yet. Never shown.
  warm: boolean
  partnerName: string | null
  onDrawn: () => Promise<void>
}) {
  const [kind, setKind] = useState<Kind | null>(null)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // The kind that just ran out across every deck, while the offer to
  // reshuffle it is up.
  const [emptied, setEmptied] = useState<Kind | null>(null)

  // No deck is ever chosen: the draw picks one at random, and it only
  // shows on the card once it is drawn.
  const draw = async () => {
    if (!kind) return
    setWorking(true)
    setProblem(null)
    try {
      const turn = await drawForSession(
        kind,
        mode,
        mode === 'in_person' ? player : undefined,
        warm,
      )
      if (turn === null) {
        setEmptied(kind)
        setWorking(false)
        return
      }
      await onDrawn()
    } catch (error) {
      setProblem(explain(error, partnerName))
      setWorking(false)
    }
  }

  const reshuffle = async () => {
    if (!emptied) return
    setWorking(true)
    setProblem(null)
    try {
      await resetDeck(null, emptied)
      setEmptied(null)
    } catch (error) {
      setProblem(explain(error, partnerName))
    }
    setWorking(false)
  }

  return (
    <section>
      <SectionLabel tone="rust">{heading}</SectionLabel>
      {handOver && <p className="td-note">{handOver}</p>}

      <div className="td-chips td-chips-two" role="radiogroup" aria-label="Truth or dare">
        {(['truth', 'dare'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={kind === name}
            className={`td-chip${kind === name ? ' td-chip-on' : ''}`}
            onClick={() => {
              setKind(name)
              setEmptied(null)
            }}
          >
            {name === 'truth' ? 'Truth' : 'Dare'}
          </button>
        ))}
      </div>

      {emptied ? (
        <div className="td-emptied">
          <p className="td-note">
            {mode === 'virtual'
              ? `Every ${emptied} you can play apart has been drawn.`
              : `Every ${emptied} has been drawn.`}{' '}
            Reshuffling brings them all back, for you alone.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={working}
            onClick={() => void reshuffle()}
          >
            {working ? 'Reshuffling…' : `Reshuffle the ${emptied}s`}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary"
          disabled={!kind || working}
          onClick={() => void draw()}
        >
          {working ? 'Drawing…' : 'Draw'}
        </button>
      )}
      {problem && <p className="line-meta line-error">{problem}</p>}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* A card in play                                                      */
/* ------------------------------------------------------------------ */

function CardInPlay({
  turn,
  userId,
  who,
  passes,
  partnerName,
  onDone,
}: {
  turn: Turn
  userId: string
  // Whose turn it is, when it isn't mine (in person only).
  who: string | null
  passes: number
  partnerName: string | null
  onDone: () => Promise<void>
}) {
  const [text, setText] = useState('')
  // The photo and a local address to preview it, made together on choosing.
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const theirs = turn.player !== userId
  const words = text.trim()
  const ready = turn.kind === 'truth' ? words.length > 0 : words.length > 0 || photo !== null

  // Let go of the preview once it is replaced or the card is gone.
  const previewUrl = photo?.preview ?? null
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const answer = async () => {
    setWorking(true)
    setProblem(null)
    try {
      const path = photo ? await uploadPhoto(userId, turn.id, photo.file) : null
      await answerTurn(turn.id, words || null, path)
      await onDone()
    } catch (error) {
      setProblem(explain(error, partnerName))
      setWorking(false)
    }
  }

  const pass = async () => {
    setWorking(true)
    setProblem(null)
    try {
      await passTurn(turn.id)
      await onDone()
    } catch (error) {
      setProblem(explain(error, partnerName))
      setWorking(false)
    }
  }

  return (
    <section>
      <SectionLabel tone="rust">{theirs ? `${possessiveName(who)} turn` : 'Your turn'}</SectionLabel>
      <PlayingCard turn={turn} />

      <textarea
        className="td-answer"
        rows={3}
        value={text}
        placeholder={turn.kind === 'truth' ? 'The truth…' : 'How it went…'}
        onChange={(event) => setText(event.target.value)}
        aria-label="Your answer"
      />
      {turn.kind === 'dare' && (
        <label className="td-photo-pick">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              setPhoto(file ? { file, preview: URL.createObjectURL(file) } : null)
            }}
          />
          {photo ? 'Change the photo' : 'Add a photo'}
        </label>
      )}
      {photo && <img className="td-photo" src={photo.preview} alt="The photo you are sending" />}

      <button
        type="button"
        className="btn-primary"
        disabled={!ready || working}
        onClick={() => void answer()}
      >
        {working
          ? 'Sending…'
          : turn.mode === 'virtual'
            ? `Answer and send to ${subjectName(partnerName)}`
            : 'Answer'}
      </button>
      <button
        type="button"
        className="btn-field"
        disabled={passes === 0 || working}
        onClick={() => void pass()}
      >
        {passes === 0
          ? 'No passes left this week'
          : `Pass (${passes} left this week)`}
      </button>
      {problem && <p className="line-meta line-error">{problem}</p>}
    </section>
  )
}

function PlayingCard({ turn }: { turn: Turn }) {
  return (
    <div className={`td-card td-deck-${turn.deck}`}>
      <p className="td-card-head">
        {deckLabel(turn.deck)} · {turn.kind === 'truth' ? 'Truth' : 'Dare'}
      </p>
      <p className="td-card-prompt">{turn.prompt}</p>
    </div>
  )
}

// How a finished turn was answered: words, a photo, or a pass.
function Answer({ turn }: { turn: Turn }) {
  if (turn.status === 'passed') return <p className="td-passed">Passed</p>
  return (
    <>
      {turn.answerText && <p className="td-answer-text">{turn.answerText}</p>}
      {turn.answerPhoto && <Photo path={turn.answerPhoto} />}
    </>
  )
}

function Photo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    void photoUrl(path)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch((error: unknown) => {
        reportQuietly('Opening a truth or dare photo', error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [path])
  if (failed) return <p className="line-meta line-error">The photo couldn't be opened.</p>
  if (!url) return <p className="line-meta">Opening the photo…</p>
  return <img className="td-photo" src={url} alt="The photo sent with the dare" />
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

function History({
  turns,
  userId,
  partnerName,
}: {
  turns: Turn[]
  userId: string
  partnerName: string | null
}) {
  const entries = historyEntries(turns, userId)
  if (entries.length === 0) return null
  return (
    <section className="td-history">
      <SectionLabel>Asked and answered</SectionLabel>
      <ul className="td-history-list">
        {entries.map((turn) => {
          const mine = turn.player === userId
          const who = mine ? 'You' : subjectName(partnerName, true)
          const meta = `${who} · ${deckLabel(turn.deck)} ${turn.kind}${turn.mode === 'in_person' ? ' · in person' : ''} · ${when(turn.answeredAt ?? turn.createdAt)}`
          if (turn.status === 'open') {
            return (
              <li key={turn.id} className="td-history-item">
                <p className="td-history-meta">{meta}</p>
                <p className="td-note">
                  {subjectName(partnerName, true)} {agree(partnerName, 'is', 'are')} on a turn.
                </p>
              </li>
            )
          }
          return (
            <li key={turn.id} className="td-history-item">
              <p className="td-history-meta">{meta}</p>
              <p className="td-history-prompt">{turn.prompt}</p>
              <Answer turn={turn} />
              {turn.reaction && (
                <p className="td-history-reaction">
                  {mine ? subjectName(partnerName, true) : 'You'}: {turn.reaction}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
