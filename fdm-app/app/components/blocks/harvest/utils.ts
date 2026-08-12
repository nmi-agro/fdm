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

export function getHarvestTerm(
  croprotation?: string | null,
  plural = false,
  harvestable?: HarvestableType | null,
  capitalized = false,
): string {
  let term: string
  if (croprotation === "grass" && harvestable !== "once") {
    term = plural ? "sneden" : "snede"
  } else {
    term = plural ? "oogsten" : "oogst"
  }
  return capitalized ? `${term.charAt(0).toUpperCase()}${term.slice(1)}` : term
}

export function getHarvestDateTerm(
  croprotation?: string | null,
  harvestable?: HarvestableType | null,
): string {
  return croprotation === "grass" && harvestable !== "once" ? "Maaidatum" : "Oogstdatum"
}
