import type { HarvestableType } from "./types"

export function getEffectiveHarvestable(
  original: HarvestableType,
  croprotation?: string | null,
): HarvestableType {
  if (original === "none") return "none"

  // For now, only grassland is allowed to have multiple harvests in the UI.
  // In the future, this restriction can be lifted to support other crops.
  if (croprotation === "grass" && original === "multiple") {
    return "multiple"
  }

  return "once"
}

export function getHarvestTerm(croprotation?: string | null, plural = false): string {
  if (croprotation === "grass") {
    return plural ? "sneden" : "snede"
  }
  return plural ? "oogsten" : "oogst"
}

export function getHarvestCapitalizedTerm(croprotation?: string | null, plural = false): string {
  if (croprotation === "grass") {
    return plural ? "Sneden" : "Snede"
  }
  return plural ? "Oogsten" : "Oogst"
}

export function getHarvestDateTerm(croprotation?: string | null): string {
  return croprotation === "grass" ? "Maaidatum" : "Oogstdatum"
}
