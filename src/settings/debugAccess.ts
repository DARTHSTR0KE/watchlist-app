import type { Mascot } from '../brand/mascots'

/**
 * The debug panels are for the goldfish's account alone. Read from the
 * profile, never a build flag, so the same build hides them from ac on
 * every device. Until the profile has loaded the mascot is null, which
 * hides them too: there is no state in which the raccoon sees them.
 */
export function showsDebugPanels(mascot: Mascot | null | undefined): boolean {
  return mascot === 'goldfish'
}
