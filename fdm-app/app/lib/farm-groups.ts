/**
 * A farm group of an organization as used by the interface, with its current member farms.
 */
export type OrganizationFarmGroup = {
  b_id_group: string
  b_name_group: string
  b_id_farms: string[]
}

/**
 * Checks whether two lists contain the same ids, regardless of order.
 */
export function hasSameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const sorted = [...b].sort()
  return [...a].sort().every((id, index) => id === sorted[index])
}
