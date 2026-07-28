import type { Cultivation } from "@nmi-agro/fdm-core"
import { findHoofdteelt } from "@nmi-agro/fdm-calculator"

/**
 * Determines the main cultivation ('hoofdteelt') for a field/year using the legal
 * Dutch definition shared with `fdm-calculator` (`findHoofdteelt`): the cultivation
 * present for the longest duration within the period May 15–July 15 of that year,
 * per the RVO Eco-regeling rules
 * (see https://www.rvo.nl/subsidies-financiering/eco-regeling-2025/eco-activiteiten-punten-en-waarde-2025).
 *
 * Unlike `findHoofdteelt` (which, for compliance calculations, falls back to the
 * regulatory code `GROENE_BRAAK`/`"nl_6794"` when nothing overlaps the window), this
 * wrapper returns `undefined` in that case so `fdm-app` never surfaces `"nl_6794"` as
 * if it were a real registered cultivation.
 *
 * This function is server-only: `fdm-calculator` cannot be imported into
 * client-rendered code, so only call this from loaders, actions, or other
 * `*.server.ts` files, and pass the resulting plain `Cultivation` down as a prop to
 * client components.
 *
 * @param cultivations - List of available cultivations.
 * @param calendarYear - The calendar year (string) to check against.
 * @returns The `Cultivation` that is the hoofdteelt for the given year, or `undefined`
 *          if none overlaps the May 15–July 15 window.
 */
export function getMainCultivation(
  cultivations: Cultivation[],
  calendarYear: string,
): Cultivation | undefined {
  if (cultivations.length === 0) {
    return undefined
  }

  const b_lu_catalogue = findHoofdteelt(
    cultivations.map((c) => ({
      b_lu_catalogue: c.b_lu_catalogue,
      b_lu_start: c.b_lu_start,
      b_lu_end: c.b_lu_end,
    })),
    Number(calendarYear),
    true,
  )

  if (b_lu_catalogue === null) {
    return undefined
  }

  return cultivations.find((c) => c.b_lu_catalogue === b_lu_catalogue)
}

export type FieldOption = {
  b_id: string
  b_name: string
  b_area: number
  b_lu_name?: string
  b_lu_croprotation?: string
}

/**
 * Builds and sorts field options for navigation/pickers across loaders.
 * Maps field details and main cultivation info for each field, then sorts
 * fields by area descending (secondary sort by name).
 */
export function buildFieldOptions(
  fields: Array<{ b_id?: string | null; b_name?: string | null; b_area?: number | null }>,
  cultivationsByField: Map<string, Cultivation[]>,
  calendarParam?: string | null,
  timeframeYear?: number,
): FieldOption[] {
  const calendarYear =
    typeof calendarParam === "string" && /^\d{4}$/.test(calendarParam)
      ? calendarParam
      : String(timeframeYear ?? new Date().getFullYear())

  return fields
    .map((field) => {
      if (!field?.b_id || !field?.b_name) {
        throw new Error("Invalid field data structure")
      }
      const fieldCultivations = cultivationsByField.get(field.b_id) ?? []
      const mainCultivation = getMainCultivation(fieldCultivations, calendarYear)
      return {
        b_id: field.b_id,
        b_name: field.b_name,
        b_area: Math.round((field.b_area ?? 0) * 10) / 10,
        b_lu_name: mainCultivation?.b_lu_name ?? undefined,
        b_lu_croprotation: mainCultivation?.b_lu_croprotation ?? undefined,
      }
    })
    .sort((a, b) => b.b_area - a.b_area || a.b_name.localeCompare(b.b_name))
}
