import type { Dose, NutrientAdviceCut } from "@nmi-agro/fdm-calculator"
import type { FertilizerApplication, Harvest } from "@nmi-agro/fdm-core"

/**
 * Dutch labels for the snedezwaarte (yield class) of a grassland cut, as returned by the NMI API.
 */
export const CUT_YIELD_CLASS_LABELS: Record<NutrientAdviceCut["yieldclass"], string> = {
  G: "Beweiding",
  LG: "Lichte beweiding",
  VLG: "Zeer lichte beweiding",
  M: "Maaien",
  LM: "Lichte maai",
  HM: "Zware maai",
}

export type CutSeasonState = "realised" | "next" | "upcoming"

export interface CutSeasonHarvest {
  b_id_harvesting: string
  date: Date
  /** Dry matter yield of the cut (kg DS/ha), when recorded. */
  dmYield: number | null
}

/**
 * Classifies the snedezwaarte of a completed cut from its dry matter yield (kg DS/ha),
 * following the standard Dutch yield classes for grassland.
 */
export function classifyYieldClass(dmYield: number): NutrientAdviceCut["yieldclass"] {
  if (dmYield <= 1000) return "VLG" // Zeer licht weiden
  if (dmYield < 1500) return "LG" // Licht weiden
  if (dmYield < 2000) return "G" // Normaal weiden
  if (dmYield < 2500) return "LM" // Licht maaien
  if (dmYield <= 3000) return "M" // Normaal maaien
  return "HM" // Zwaar maaien
}

export interface CutSeasonRow {
  /** Cut number within the year (1–6). */
  cut: number
  /**
   * Advice variants for this snede, one per snedezwaarte, in API order. The snedezwaarte is a
   * scenario the advisor chooses (grazing, mowing, …); only one applies per snede.
   */
  variants: NutrientAdviceCut[]
  /**
   * Position of the snede within the season: `null` when the viewed calendar year is not the
   * current calendar year, in which case the table renders statically without state.
   */
  state: CutSeasonState | null
  /** Recorded harvest attributed to this snede. */
  harvest: CutSeasonHarvest | null
  /**
   * Snedezwaarte derived from the recorded dry matter yield of this snede, when available.
   * When set, the snedezwaarte is a fact, not a choice, and only shown when the API returned
   * an advice variant for it.
   */
  derivedYieldClass: NutrientAdviceCut["yieldclass"] | null
  /**
   * Workable nitrogen applied in the window feeding this snede. `null` when attribution is
   * impossible: no recorded harvest for this snede, or no harvest dates at all.
   */
  nitrogenDose: number | null
}

export interface CutSeason {
  rows: CutSeasonRow[]
  /** Whether any row carries a recorded harvest, so the Oogst/Vulling columns can be hidden otherwise. */
  hasHarvests: boolean
}

/**
 * Builds the season rows for the "Advies per snede" table.
 *
 * The NMI API returns one advice entry per (snede × snedezwaarte) combination; entries are
 * grouped per snede and the table lets the advisor pick the applicable snedezwaarte per row.
 *
 * Harvests are attributed positionally: the i-th recorded harvest (by date) belongs to snede i,
 * and a snede's filling window runs from the previous recorded harvest (exclusive) up to and
 * including its own harvest; the first snede receives everything before the first harvest.
 * Applications after the last recorded harvest stay unattributed, since the window they feed is
 * still open. When a completed snede has a recorded dry matter yield, its snedezwaarte is
 * derived from that yield via `classifyYieldClass`. Harvest attribution and filling apply to
 * every viewed year; the realised/next-upcoming state is only computed for the current
 * calendar year.
 */
export function buildCutSeason({
  cuts,
  harvests,
  fertilizerApplications,
  doses,
  isCurrentYear,
  today,
}: {
  cuts: NutrientAdviceCut[]
  harvests: Harvest[]
  fertilizerApplications: FertilizerApplication[]
  doses: Dose[]
  isCurrentYear: boolean
  today: Date
}): CutSeason {
  const variantsByCut = new Map<number, NutrientAdviceCut[]>()
  for (const cut of cuts) {
    const variants = variantsByCut.get(cut.cut) ?? []
    variants.push(cut)
    variantsByCut.set(cut.cut, variants)
  }
  const cutNumbers = [...variantsByCut.keys()].sort((a, b) => a - b)

  const datedHarvests: CutSeasonHarvest[] = harvests
    .filter((harvest) => harvest.b_lu_harvest_date)
    .map((harvest) => ({
      b_id_harvesting: harvest.b_id_harvesting,
      date: new Date(harvest.b_lu_harvest_date as unknown as string),
      dmYield: harvest.harvestable?.harvestable_analyses?.[0]?.b_lu_yield ?? null,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  // Dose per application, keyed by application id, joined with its application date.
  const doseByApplicationId = new Map(doses.map((dose) => [dose.p_app_id, dose.p_dose_nw]))
  const datedApplications = fertilizerApplications
    .filter(
      (application) => application.p_app_date && doseByApplicationId.has(application.p_app_id),
    )
    .map((application) => ({
      date: new Date(application.p_app_date as unknown as string),
      dose: doseByApplicationId.get(application.p_app_id) ?? 0,
    }))

  const firstUpcomingIndex = cutNumbers.findIndex((_cut, index) => {
    const harvest = datedHarvests[index]
    return !harvest || harvest.date.getTime() > today.getTime()
  })

  const rows = cutNumbers.map((cut, index): CutSeasonRow => {
    const variants = variantsByCut.get(cut) ?? []
    const harvest = datedHarvests[index] ?? null

    let nitrogenDose: number | null = null
    if (harvest) {
      const windowStart = index > 0 ? datedHarvests[index - 1].date : null
      nitrogenDose = datedApplications
        .filter((application) => {
          if (application.date.getTime() > harvest.date.getTime()) {
            return false
          }
          return windowStart ? application.date.getTime() > windowStart.getTime() : true
        })
        .reduce((sum, application) => sum + application.dose, 0)
    }

    const derived =
      harvest?.dmYield !== null && harvest?.dmYield !== undefined
        ? classifyYieldClass(harvest.dmYield)
        : null

    const realised = harvest !== null && harvest.date.getTime() <= today.getTime()

    return {
      cut,
      variants,
      state: !isCurrentYear
        ? null
        : realised
          ? "realised"
          : index === firstUpcomingIndex
            ? "next"
            : "upcoming",
      harvest,
      derivedYieldClass: derived && variants.some((v) => v.yieldclass === derived) ? derived : null,
      nitrogenDose,
    }
  })

  return { rows, hasHarvests: datedHarvests.length > 0 }
}
