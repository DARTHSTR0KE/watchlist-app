/**
 * Ten short scenes of the two of them, now and then, on the screens with
 * room for them. The raccoon is ac and the goldfish is the other of the
 * two, in every one — these are fixed scenes and do not swap round by
 * account.
 *
 * Nothing here is logged. These are not events.
 */

export const IDLE_SCENES = [
  'high-five',
  'blanket',
  'sway',
  'polish',
  'yawn',
  'look-off',
  'splash',
  'sulk',
  'bubbles',
  'doze',
] as const

export type IdleScene = (typeof IDLE_SCENES)[number]

// Roughly one eligible screen visit in five.
export const PLAY_CHANCE = 0.2

export interface IdleHistory {
  // Whether the previous eligible visit played a scene.
  lastVisitPlayed: boolean
  lastScene: IdleScene | null
}

/**
 * Whether this visit gets a scene, and which. Never two visits running,
 * never the same scene twice running, otherwise one visit in five, and the
 * scene picked evenly from the other nine.
 */
export function chooseScene(history: IdleHistory, random: () => number): IdleScene | null {
  if (history.lastVisitPlayed) return null
  if (random() >= PLAY_CHANCE) return null
  const choices = IDLE_SCENES.filter((scene) => scene !== history.lastScene)
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
}

/* ------------------------------------------------------------------ */
/* Remembered on this device                                           */
/* ------------------------------------------------------------------ */

const KEY = 'idle-scene-history'

export function readHistory(): IdleHistory {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<IdleHistory> | null
    const lastScene = IDLE_SCENES.find((scene) => scene === parsed?.lastScene) ?? null
    return { lastVisitPlayed: parsed?.lastVisitPlayed === true, lastScene }
  } catch {
    // Unreadable storage: treat the last visit as having played, so a
    // scene can't come round on every single visit.
    return { lastVisitPlayed: true, lastScene: null }
  }
}

export function writeHistory(history: IdleHistory): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(history))
  } catch {
    // Nothing to do.
  }
}

/* ------------------------------------------------------------------ */
/* TEMPORARY: forcing one on every visit, to confirm all ten play      */
/* ------------------------------------------------------------------ */

const FORCE_KEY = 'idle-scene-force'

export function isForcing(): boolean {
  try {
    return window.localStorage.getItem(FORCE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setForcing(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(FORCE_KEY, 'on')
    else window.localStorage.removeItem(FORCE_KEY)
  } catch {
    // Nothing to do.
  }
}

// While forcing, each visit plays the next of the ten in order.
export function nextInTurn(last: IdleScene | null): IdleScene {
  const index = last === null ? -1 : IDLE_SCENES.indexOf(last)
  return IDLE_SCENES[(index + 1) % IDLE_SCENES.length]
}
