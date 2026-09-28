/**
 * The debug section is for the master account alone. Only a definite yes
 * from the database shows it: while that is still being asked, or if it
 * failed, the answer is null and nothing renders, so there is no state in
 * which ac sees it.
 */
export function showsDebugPanels(isMaster: boolean | null): boolean {
  return isMaster === true
}
