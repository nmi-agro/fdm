import type { CurrentSoilData } from "@nmi-agro/fdm-core"

/** Whether the current soil data of a field is measured, estimated or missing. */
export type SoilStatus = "estimated" | "measured" | "missing"

/**
 * Classifies the current soil data of a field: `measured` when a source other than the NMI
 * estimate (`nl-other-nmi`) contributes, `estimated` when only that estimate contributes, and
 * `missing` without any soil data.
 *
 * @param currentSoilData - The current soil data of the field, or an empty list.
 * @returns The soil status of the field.
 */
export function getSoilStatus(currentSoilData: CurrentSoilData | []): SoilStatus {
  if (currentSoilData.length === 0) return "missing"

  const sources = new Set(
    currentSoilData.flatMap((item) => item.sources.map((source) => source.a_source)),
  )
  if (Array.from(sources).some((source) => source !== "nl-other-nmi")) return "measured"
  if (sources.has("nl-other-nmi")) return "estimated"
  return "missing"
}
