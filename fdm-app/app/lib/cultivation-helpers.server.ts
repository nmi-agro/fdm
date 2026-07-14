import type { Cultivation } from "@nmi-agro/fdm-core"
import { findHoofdteelt } from "@nmi-agro/fdm-calculator"

/**
 * Server-only cultivation helpers.
 *
 * @nmi-agro/fdm-calculator cannot be imported in client code because its barrel
 * export transitively pulls in fdm-core which uses node:async_hooks.
 * This .server.ts file ensures Vite never includes it in client bundles.
 */

/**
 * Determines the main cultivation ('hoofdteelt') for a field/year.
 *
 * This is a thin wrapper around the calculator's {@link findHoofdteelt}, which
 * is the single source of truth for the RVO Eco-regeling rule (longest-duration
 * cultivation within the May 15–July 15 window, alphabetic tie-break). Using the
 * same algorithm here guarantees the label users see matches the value that
 * feeds the calculations.
 *
 * The regulatory `GROENE_BRAAK` fallback is intentionally suppressed
 * (`fallback: false`): UI callers want to know when *no* cultivation is
 * registered, so this returns `undefined` in that case rather than a synthetic
 * catalogue code that has no matching cultivation object.
 *
 * @param cultivations - List of available cultivations.
 * @param calendarYear - The calendar year (string) to check against.
 * @returns The main cultivation for the year, or `undefined` if none overlaps
 *          the May 15–July 15 window.
 */
export function getDefaultCultivation(
  cultivations: Cultivation[],
  calendarYear: string,
): Cultivation | undefined {
  const b_lu_catalogue = findHoofdteelt(cultivations, Number(calendarYear), { fallback: false })
  if (!b_lu_catalogue) {
    return undefined
  }
  return cultivations.find((cultivation) => cultivation.b_lu_catalogue === b_lu_catalogue)
}
