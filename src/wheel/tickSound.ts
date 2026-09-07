import { useState } from 'react'

const MUTE_STORAGE_KEY = 'spin-wheel-muted'

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — default
    // to sound on rather than silently muting.
    return false
  }
}

function persistMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false')
  } catch {
    // Preference just won't survive a reload; not worth surfacing.
  }
}

export function useMuted(): [boolean, () => void] {
  const [muted, setMutedState] = useState(isMuted)

  // Persisted outside the state updater, so callers can immediately act on
  // the new value — the unmute confirmation tick reads it straight back.
  const toggle = () => {
    const next = !muted
    persistMuted(next)
    setMutedState(next)
  }

  return [muted, toggle]
}

let audioContext: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

// Must be called synchronously from the tap that starts a spin — the
// context is constructed before the first await, so it still counts as
// gesture-initiated. One built at page load starts 'suspended' under
// autoplay policy and never makes a sound, silently.
//
// Resolves once the context is actually running, so a caller can await it
// before the first tick rather than scheduling into a suspended context
// and having everything bunch up when it resumes.
export async function ensureAudioContext(): Promise<void> {
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioContext = new Ctor()
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  } catch {
    // Audio is a nice-to-have. Leave it null and let spins run silently.
    audioContext = null
  }
}

// Measured peak output, at these constants, across the full per-tick jitter
// range: -11.6 to -10.8 dBFS, staying above 1% of full scale for 11.9-14.2ms.
const TICK_GAIN = 0.65
const TICK_DECAY_S = 0.028
const TICK_FILTER_Q = 1
const NOISE_SECONDS = 0.06

// Small seeded PRNG. The buffer is generated once and reused, so with
// Math.random() the click's loudness was fixed per page load but varied
// 5.3dB between loads — enough to land outside the target band. A fixed
// seed makes it reproducible; per-tick variation comes from the filter and
// playback rate instead.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A spin fires dozens of ticks a second, so this is built once and reused.
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
    noiseBuffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    const random = mulberry32(0x9e3779b9)
    for (let i = 0; i < frameCount; i++) {
      data[i] = random() * 2 - 1
    }
  }
  return noiseBuffer
}

// A synthesised click: a few milliseconds of noise through a bandpass with
// a fast decay. Filter frequency and playback rate wobble slightly per tick
// so a fast spin doesn't sound like one sample on loop.
export function playTick(): void {
  if (isMuted()) return
  const ctx = audioContext
  // Scheduling into a suspended context doesn't drop the sound, it defers
  // it — a spin's worth would then fire at once on resume. Skip instead.
  if (!ctx || ctx.state !== 'running') return

  try {
    const now = ctx.currentTime

    const source = ctx.createBufferSource()
    source.buffer = getNoiseBuffer(ctx)
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.3

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800 + (Math.random() - 0.5) * 400
    filter.Q.value = TICK_FILTER_Q

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(TICK_GAIN, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + TICK_DECAY_S)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.start(now)
    source.stop(now + TICK_DECAY_S + 0.02)
  } catch {
    // Never let an audio glitch interfere with the spin itself.
  }
}
