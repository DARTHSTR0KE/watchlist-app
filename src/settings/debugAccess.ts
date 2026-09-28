/**
 * Clear all data and the debug section are for the master account alone.
 * Only a definite yes from the database shows them: while that is still
 * being asked, or if it failed, the answer is null and nothing renders, so
 * there is no state in which ac sees either.
 */
export function showsMasterOnly(isMaster: boolean | null): boolean {
  return isMaster === true
}
