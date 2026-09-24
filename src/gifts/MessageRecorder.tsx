import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { describeError } from '../lib/dbError'
import { agree, possessiveName, subjectName } from '../utils/names'
import { MESSAGE_MAX_BYTES, MESSAGE_MAX_SECONDS, sizeLabel, tooBig } from './giftWindow'
import { sendMessage } from './gifts'
import type { MyGift } from './gifts'

type Stage =
  | { kind: 'choose' }
  | { kind: 'asking' }
  // Refused, or no camera at all: say what it was for, offer the file.
  | { kind: 'no-camera'; reason: 'refused' | 'missing' | 'unsupported' }
  | { kind: 'ready' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'review'; video: Blob; url: string }
  | { kind: 'confirm'; video: Blob; url: string }
  | { kind: 'sending'; video: Blob; url: string }

/**
 * The first type the phone can record in. MP4 first: it plays everywhere,
 * including an iPhone, which WebM does not reliably. Empty lets the
 * browser choose.
 */
function recorderType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const options = [
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return options.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? ''
}

// Kept under the 25 MB limit for a full minute with room to spare.
const VIDEO_BITS_PER_SECOND = 2_000_000

// A file's own length, when it will say. Some files report Infinity until
// played through; those are taken on trust and the size limit still holds.
function durationOf(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(probe.duration) ? probe.duration : null)
    }
    probe.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    probe.src = url
  })
}

export function MessageRecorder({
  userId,
  partnerId,
  partnerName,
  year,
  onSent,
}: {
  userId: string
  partnerId: string
  partnerName: string | null
  year: number
  onSent: (gift: MyGift) => void
}) {
  const [stage, setStage] = useState<Stage>({ kind: 'choose' })
  const [problem, setProblem] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(MESSAGE_MAX_SECONDS)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const them = subjectName(partnerName)

  const stopCamera = () => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }

  // The camera light goes off whenever this leaves the screen, however it
  // leaves.
  useEffect(() => () => stopCamera(), [])

  // A take's object URL is released once it is no longer the one showing.
  const reviewUrl = stage.kind === 'review' || stage.kind === 'confirm' || stage.kind === 'sending'
    ? stage.url
    : null
  useEffect(() => {
    if (!reviewUrl) return
    return () => URL.revokeObjectURL(reviewUrl)
  }, [reviewUrl])

  // The live picture, once there is a stream and something to show it in.
  useEffect(() => {
    if ((stage.kind === 'ready' || stage.kind === 'recording') && previewRef.current) {
      previewRef.current.srcObject = streamRef.current
    }
  }, [stage.kind])

  // The countdown, and the stop at zero.
  useEffect(() => {
    if (stage.kind !== 'recording') return
    const tick = () => {
      const left = MESSAGE_MAX_SECONDS - Math.floor((performance.now() - stage.startedAt) / 1000)
      setSecondsLeft(Math.max(0, left))
      if (left <= 0) recorderRef.current?.stop()
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [stage])

  const openCamera = async () => {
    setProblem(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStage({ kind: 'no-camera', reason: 'unsupported' })
      return
    }
    setStage({ kind: 'asking' })
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true,
      })
      setStage({ kind: 'ready' })
    } catch (error) {
      const name = (error as { name?: string }).name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStage({ kind: 'no-camera', reason: 'refused' })
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStage({ kind: 'no-camera', reason: 'missing' })
      } else {
        setProblem(`The camera couldn't start: ${describeError(error)}`)
        setStage({ kind: 'choose' })
      }
    }
  }

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream) return
    const type = recorderType()
    const recorder = new MediaRecorder(stream, {
      ...(type ? { mimeType: type } : {}),
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
    })
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      stopCamera()
      const video = new Blob(chunksRef.current, { type: recorder.mimeType || type || 'video/webm' })
      if (tooBig(video.size, MESSAGE_MAX_BYTES)) {
        setProblem(`That take came out at ${sizeLabel(video.size)}, over the 25 MB limit. Try a shorter one.`)
        setStage({ kind: 'choose' })
        return
      }
      setStage({ kind: 'review', video, url: URL.createObjectURL(video) })
    }
    recorderRef.current = recorder
    recorder.start(1000)
    setSecondsLeft(MESSAGE_MAX_SECONDS)
    setStage({ kind: 'recording', startedAt: performance.now() })
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProblem(null)
    if (!file.type.startsWith('video/')) {
      setProblem("That isn't a video file.")
      return
    }
    if (tooBig(file.size, MESSAGE_MAX_BYTES)) {
      setProblem(`That file is ${sizeLabel(file.size)}; the limit is 25 MB.`)
      return
    }
    const seconds = await durationOf(file)
    if (seconds !== null && seconds > MESSAGE_MAX_SECONDS + 0.5) {
      setProblem(`That video is ${Math.round(seconds)} seconds; the limit is ${MESSAGE_MAX_SECONDS}.`)
      return
    }
    stopCamera()
    setStage({ kind: 'review', video: file, url: URL.createObjectURL(file) })
  }

  const send = async () => {
    if (stage.kind !== 'confirm') return
    setStage({ ...stage, kind: 'sending' })
    setProblem(null)
    try {
      onSent(await sendMessage(userId, partnerId, year, stage.video))
    } catch (error) {
      setProblem(`Couldn't send it: ${describeError(error)}`)
      setStage({ ...stage, kind: 'confirm' })
    }
  }

  const uploadInstead = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(event) => void handleFile(event)}
      />
      <button type="button" className="btn-field" onClick={() => fileRef.current?.click()}>
        Upload a video instead
      </button>
    </>
  )

  return (
    <div className="gift-recorder">
      {stage.kind === 'choose' && (
        <>
          <p className="screen-empty">
            Up to a minute, for the end of {possessiveName(partnerName)} Wrapped.
            You can watch it back before it goes.
          </p>
          <button type="button" className="btn-field" onClick={() => void openCamera()}>
            Record a message
          </button>
          {uploadInstead}
        </>
      )}

      {stage.kind === 'asking' && (
        <p className="screen-empty">Asking for the camera and microphone…</p>
      )}

      {stage.kind === 'no-camera' && (
        <>
          <p className="screen-empty">
            {stage.reason === 'refused'
              ? `The camera and microphone are only for recording this message — nothing is recorded until you press record, and it goes nowhere but ${possessiveName(partnerName)} Wrapped. To record here, allow them in your browser's site settings. Or record it anywhere you like and upload the video.`
              : stage.reason === 'missing'
                ? "This device doesn't seem to have a camera and microphone to record with. You can upload a video instead."
                : "This browser can't record video here. You can upload a video instead."}
          </p>
          {stage.reason === 'refused' && (
            <button type="button" className="btn-field" onClick={() => void openCamera()}>
              Try the camera again
            </button>
          )}
          {uploadInstead}
        </>
      )}

      {(stage.kind === 'ready' || stage.kind === 'recording') && (
        <>
          <video ref={previewRef} className="gift-video gift-video-live" autoPlay muted playsInline />
          {stage.kind === 'recording' ? (
            <>
              <p className="gift-countdown" aria-live="polite">
                <span className="gift-recording-dot" aria-hidden="true" /> {secondsLeft}s left
              </p>
              <button type="button" className="btn-primary" onClick={() => recorderRef.current?.stop()}>
                Stop
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-primary" onClick={startRecording}>
                Start recording
              </button>
              <button
                type="button"
                className="btn-field"
                onClick={() => {
                  stopCamera()
                  setStage({ kind: 'choose' })
                }}
              >
                Cancel
              </button>
            </>
          )}
        </>
      )}

      {(stage.kind === 'review' || stage.kind === 'confirm' || stage.kind === 'sending') && (
        <>
          <video className="gift-video" src={stage.url} controls playsInline />
          {stage.kind === 'review' ? (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setStage({ ...stage, kind: 'confirm' })}
              >
                Keep this one
              </button>
              <button type="button" className="btn-field" onClick={() => setStage({ kind: 'choose' })}>
                Discard it
              </button>
            </>
          ) : (
            <>
              {/* Said before the button, not after: this is the last
                  point it can be changed. */}
              <p className="gift-lock-warning">
                Once you send this, it's locked for the year. You won't be able to change it,
                re-record it or take it back, and {them} {agree(partnerName, 'sees', 'see')} it on
                15 December.
              </p>
              <button
                type="button"
                className="btn-primary"
                disabled={stage.kind === 'sending'}
                onClick={() => void send()}
              >
                {stage.kind === 'sending' ? 'Sending…' : 'Send it'}
              </button>
              <button
                type="button"
                className="btn-field"
                disabled={stage.kind === 'sending'}
                onClick={() => setStage({ ...stage, kind: 'review' })}
              >
                Not yet
              </button>
            </>
          )}
        </>
      )}

      {problem && <p className="line-meta line-error">{problem}</p>}
    </div>
  )
}
