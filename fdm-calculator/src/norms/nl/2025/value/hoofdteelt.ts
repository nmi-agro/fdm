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
export function determineNLHoofdteelt(
  cultivations: NL2025NormsInputForCultivation[],
  year: 2025 | 2026,
): string {
  const normalized = cultivations.map((c) => ({
    ...c,
    b_lu_start: c.b_lu_start ?? new Date(0),
  }))
  return findHoofdteelt(normalized, year)
}
