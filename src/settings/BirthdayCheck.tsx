import { useState } from 'react'
import {
  PLAYED_KEY,
  clearPlayedRecord,
  isBirthday,
  localDateKey,
  prefersReducedMotion,
  readPlayedRecord,
} from '../birthday/birthdayDate'
import { introVideoUrl } from './introSource'
import { SectionLabel } from '../ui/Screen'

/**
 * TEMPORARY. Shows what the birthday gate sees on this phone, and times the
 * video the way the gate loads it. Comes out once the video is fixed.
 */

// The gate gives up if the video isn't ready within this long.
const GATE_LIMIT_MS = 2000

async function probeVideo(): Promise<string> {
  const url = introVideoUrl()
  const started = performance.now()
  let status = 'no answer'
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-1' }, cache: 'no-store' })
    status = `HTTP ${response.status}`
  } catch (error) {
    status = `fetch failed (${error instanceof Error ? error.message : String(error)})`
  }
  const fetched = Math.round(performance.now() - started)

  // Exactly as the gate does it: preload metadata and wait for it.
  const ready = await new Promise<string>((resolve) => {
    const video = document.createElement('video')
    const t0 = performance.now()
    const timer = window.setTimeout(() => resolve('not ready after 10 s'), 10000)
    const done = (what: string) => {
      window.clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      resolve(what)
    }
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      const ms = Math.round(performance.now() - t0)
      done(`ready in ${ms} ms${ms > GATE_LIMIT_MS ? ' (the gate would have given up)' : ''}`)
    }
    video.onerror = () => done(`error loading (code ${video.error?.code ?? '?'})`)
    video.src = url
  })
  return `${status} in ${fetched} ms; video ${ready}`
}

export function BirthdayCheck() {
  const [record, setRecord] = useState(readPlayedRecord)
  const [probe, setProbe] = useState<string | null>(null)
  const now = new Date()

  return (
    <section>
      <SectionLabel>Birthday video check (temporary)</SectionLabel>
      <p className="filter-hint">
        Played record ({PLAYED_KEY}): <strong>{record ?? 'nothing stored'}</strong>
        <br />
        This phone&apos;s date: {localDateKey(now)}
        {isBirthday(now) ? ' (the day)' : ''}
        <br />
        Reduced motion: {prefersReducedMotion() ? 'ON, so the video never plays by itself' : 'off'}
        <br />
        Video: {probe ?? 'not checked yet'}
      </p>
      <button
        type="button"
        className="btn-field"
        onClick={() => {
          clearPlayedRecord()
          setRecord(readPlayedRecord())
        }}
      >
        Clear the played record
      </button>
      <button
        type="button"
        className="btn-field"
        onClick={() => {
          setProbe('checking…')
          void probeVideo().then(setProbe)
        }}
      >
        Time the video load
      </button>
    </section>
  )
}
