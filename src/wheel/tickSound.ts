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

  const toggle = () => {
    setMutedState((previous) => {
      const next = !previous
      persistMuted(next)
      return next
    })
  }

  return [muted, toggle]
}

let audioContext: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

// Must be called synchronously from the tap that starts a spin. An
// AudioContext constructed at page load starts 'suspended' under browser
// autoplay policy and never makes a sound — silently, with no error.
export function ensureAudioContext(): void {
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioContext = new Ctor()
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }
  } catch {
    // Audio is a nice-to-have. Leave it null and let spins run silently.
    audioContext = null
  }
}

// One buffer of white noise, generated once and reused by every tick — a
// spin fires dozens of these a second, so per-tick allocation is not free.
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * 0.03))
    noiseBuffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1
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
  if (!ctx) return

  try {
    const now = ctx.currentTime
    const duration = 0.015

    const source = ctx.createBufferSource()
    source.buffer = getNoiseBuffer(ctx)
    source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.3

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800 + (Math.random() - 0.5) * 400
    filter.Q.value = 3

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.5, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.start(now)
    source.stop(now + duration + 0.01)
  } catch {
    // Never let an audio glitch interfere with the spin itself.
  }
}
