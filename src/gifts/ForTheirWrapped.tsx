import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { SectionLabel } from '../ui/Screen'
import { describeError, reportQuietly } from '../lib/dbError'
import { agree, possessiveName, subjectName } from '../utils/names'
import {
  TRACK_MAX_BYTES,
  giftWindow,
  giftYear,
  sizeLabel,
  tooBig,
} from './giftWindow'
import { giftWaiting, loadMyGift, saveTrack, signedUrl } from './gifts'
import type { MyGift } from './gifts'
import { MessageRecorder } from './MessageRecorder'

/**
 * For their Wrapped: a song and a message, left between 1 and 14 December.
 * Outside those dates it only says when it opens, or that it has closed.
 *
 * Everything shown here is mine. What they left me is one line at most —
 * that something is waiting — and never what.
 */
export function ForTheirWrapped({
  userId,
  partnerId,
  partnerName,
}: {
  userId: string
  partnerId: string
  partnerName: string | null
}) {
  const [now] = useState(() => new Date())
  const state = giftWindow(now)
  const year = giftYear(now)
  const them = subjectName(partnerName)

  const [gift, setGift] = useState<MyGift | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    // Nothing to read outside December: the section only says when it opens.
    if (state === 'before') return
    let cancelled = false
    void loadMyGift(userId, year)
      .then((mine) => {
        if (!cancelled) setGift(mine)
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(`Couldn't load what you've left: ${describeError(error)}`)
      })
    void giftWaiting(year)
      .then((yes) => {
        if (!cancelled) setWaiting(yes)
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(`Couldn't check for a gift: ${describeError(error)}`)
      })
    return () => {
      cancelled = true
    }
  }, [userId, year, state])

  const waitingLine = waiting && (
    <p className="gift-waiting">
      {subjectName(partnerName, true)} {agree(partnerName, 'has', 'have')} left something for you.
    </p>
  )

  return (
    <section>
      <SectionLabel tone="sage">For their Wrapped</SectionLabel>

      {state === 'before' && (
        <p className="screen-empty">
          Opens on 1 December. Until the 14th you can leave {them} two things for{' '}
          {possessiveName(partnerName)} Wrapped: a song to play behind it, and a message at the end.
        </p>
      )}

      {state === 'closed' && (
        <>
          {waitingLine}
          <p className="screen-empty">
            {gift && (gift.trackPath || gift.messageAt)
              ? `Closed for this year. ${subjectName(partnerName, true)} ${agree(partnerName, 'sees', 'see')} what you left in ${possessiveName(partnerName)} Wrapped.`
              : 'Closed for this year. It opens again on 1 December.'}
          </p>
        </>
      )}

      {state === 'open' && (
        <>
          {waitingLine}
          <p className="screen-empty">
            Neither of you sees what the other chose until the 15th. You can change the song
            until then; the message is final once sent.
          </p>
          {failure ? (
            <p className="screen-empty">{failure}</p>
          ) : gift === null ? (
            <p className="screen-empty">Loading…</p>
          ) : (
            <>
              <TrackPicker
                userId={userId}
                partnerId={partnerId}
                year={year}
                gift={gift}
                onSaved={setGift}
              />
              <MessageBlock
                userId={userId}
                partnerId={partnerId}
                partnerName={partnerName}
                year={year}
                gift={gift}
                onSent={setGift}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}

// A private file, played through a short-lived signed URL.
function useSignedUrl(path: string | null, version: string | null): string | null {
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null)
  const key = `${path}@${version}`
  useEffect(() => {
    if (!path) return
    let cancelled = false
    void signedUrl(path)
      .then((signed) => {
        if (!cancelled) setUrl({ key, url: signed })
      })
      // The file is still there; only playing it back fails. Kept for
      // Settings rather than shown in place of the controls.
      .catch((error: unknown) => reportQuietly('Signing a gift for playback', error))
    return () => {
      cancelled = true
    }
  }, [path, key])
  return url?.key === key ? url.url : null
}

function TrackPicker({
  userId,
  partnerId,
  year,
  gift,
  onSaved,
}: {
  userId: string
  partnerId: string
  year: number
  gift: MyGift
  onSaved: (gift: MyGift) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // track_at changes on every replacement, so the player reloads with it.
  const url = useSignedUrl(gift.trackPath, gift.trackAt)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProblem(null)
    if (!file.type.startsWith('audio/')) {
      setProblem("That isn't an audio file.")
      return
    }
    if (tooBig(file.size, TRACK_MAX_BYTES)) {
      setProblem(`That file is ${sizeLabel(file.size)}; the limit is 8 MB.`)
      return
    }
    setBusy(true)
    try {
      onSaved(await saveTrack(userId, partnerId, year, file))
    } catch (error) {
      setProblem(`Couldn't upload that: ${describeError(error)}`)
    }
    setBusy(false)
  }

  return (
    <div className="gift-block">
      <h4 className="stat-subtitle">The song</h4>
      {gift.trackPath && (
        <>
          <p className="gift-name">{gift.trackTitle ?? 'Untitled'}</p>
          {url && <audio className="gift-audio" src={url} controls preload="none" />}
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => void handleFile(event)}
      />
      <button
        type="button"
        className="btn-field"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? 'Uploading…' : gift.trackPath ? 'Replace the song' : 'Choose a song'}
      </button>
      <p className="line-meta">An audio file under 8 MB.</p>
      {problem && <p className="line-meta line-error">{problem}</p>}
    </div>
  )
}

function MessageBlock({
  userId,
  partnerId,
  partnerName,
  year,
  gift,
  onSent,
}: {
  userId: string
  partnerId: string
  partnerName: string | null
  year: number
  gift: MyGift
  onSent: (gift: MyGift) => void
}) {
  const url = useSignedUrl(gift.messageAt ? gift.messagePath : null, gift.messageAt)
  const sentOn = gift.messageAt
    ? new Date(gift.messageAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    : null

  return (
    <div className="gift-block">
      <h4 className="stat-subtitle">The message</h4>
      {gift.messageAt ? (
        <>
          <p className="line-meta">Sent on {sentOn}. It's locked for this year.</p>
          {url && <video className="gift-video" src={url} controls playsInline preload="metadata" />}
        </>
      ) : (
        <MessageRecorder
          userId={userId}
          partnerId={partnerId}
          partnerName={partnerName}
          year={year}
          onSent={onSent}
        />
      )}
    </div>
  )
}
