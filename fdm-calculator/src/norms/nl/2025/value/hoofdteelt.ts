import type { NL2025NormsInputForCultivation } from "./types"
import { findHoofdteelt } from "../../../../shared/hoofdteelt"

/**
 * Determines the main cultivation ('hoofdteelt') for the NL 2025 and 2026 norms.
 *
 * Delegates to `findHoofdteelt`. Cultivations without a `b_lu_start` are treated
 * as always present (epoch), preserving the original norms behaviour where an
 * unknown start date means the cultivation was already in the ground at the start
 * of the reference period.
 *
 * @param cultivations - Array of cultivation inputs for the field.
 * @param year - The norm year (2025 or 2026).
 * @returns The `b_lu_catalogue` of the hoofdteelt, or `"nl_6794"` if none found.
 */
export function determineNLHoofdteelt<T extends NL2025NormsInputForCultivation>(
  cultivations: T[],
  year: number,
  returnObject?: false,
): string
export function determineNLHoofdteelt<T extends NL2025NormsInputForCultivation>(
  cultivations: T[],
  year: number,
  returnObject: true,
): T | undefined
export function determineNLHoofdteelt<T extends NL2025NormsInputForCultivation>(
  cultivations: T[],
  year: number,
  returnObject = false,
): string | T | undefined {
  const normalized = cultivations.map((c) => ({
    ...c,
    b_lu_start: c.b_lu_start ?? new Date(0),
  }))
  const code = findHoofdteelt(normalized, year)
  if (!returnObject) {
    return code
  }
  if (code === "nl_6794") return undefined
  const windowStart = new Date(`${year}-05-15`).getTime()
  const windowEnd = new Date(`${year}-07-15`).getTime()
  return (
    cultivations.find((c) => {
      if (c.b_lu_catalogue !== code) return false
      const start = c.b_lu_start ? new Date(c.b_lu_start).getTime() : 0
      const end = c.b_lu_end ? new Date(c.b_lu_end).getTime() : windowEnd
      return start <= windowEnd && end >= windowStart
    }) ?? cultivations.find((c) => c.b_lu_catalogue === code)
  )
}
