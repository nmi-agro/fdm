import {
  type CultivationCatalogue,
  type FdmType,
  getCultivationsFromCatalogue,
  getSeasonPlanProgress,
  type PrincipalId,
  resolveSeasonPlanTarget,
  type SeasonPlanProgress,
  type SeasonPlanStep,
  toFdmDateString,
} from "@nmi-agro/fdm-core"

/** The progress of one step, reduced to what the app shows. */
export type SeasonPlanStepSummary = {
  step: SeasonPlanStep
  done: boolean
  /** Number of items that block completion of the step. */
  pending: number
  /** Number of items to review that do not block completion. */
  notices: number
}

/** The progress of the season plan of a year, reduced to what the app shows. */
export type SeasonPlanSummary = {
  year: number
  complete: boolean
  started: boolean
  firstIncompleteStep: SeasonPlanStep | null
  /** Total number of blocking items. */
  openItems: number
  steps: SeasonPlanStepSummary[]
}

/** Reduces the progress of a season plan to plain, serializable data for a loader. */
export function summarizeSeasonPlanProgress(progress: SeasonPlanProgress): SeasonPlanSummary {
  const steps = progress.steps.map((step) => ({
    step: step.step,
    done: step.done,
    pending: step.pending.length,
    notices: step.notices.length,
  }))
  return {
    year: progress.targetYear,
    complete: progress.complete,
    started: progress.started,
    firstIncompleteStep: progress.firstIncompleteStep,
    openItems: steps.reduce((total, step) => total + step.pending, 0),
    steps,
  }
}

/**
 * Returns the step the wizard opens for a year: the start step when nothing has been recorded
 * for the year yet, else the first incomplete step, or the last step when the plan is complete.
 */
export function getResumeStep(summary: SeasonPlanSummary): SeasonPlanStep {
  if (!summary.started) return "start"
  return summary.firstIncompleteStep ?? "harvests"
}

/**
 * Returns the default year of the season planning wizard with its progress and the years that
 * can be chosen, or `null` when the farm has no main cultivations to plan from.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The ID of the principal.
 * @param b_id_farm - The ID of the farm.
 */
export async function getSeasonPlanEntry(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
): Promise<{ summary: SeasonPlanSummary; availableYears: number[] } | null> {
  const target = await resolveSeasonPlanTarget(fdm, principal_id, b_id_farm)
  if (!target) return null
  const progress = await getSeasonPlanProgress(fdm, principal_id, b_id_farm, target.targetYear)
  return { summary: summarizeSeasonPlanProgress(progress), availableYears: target.availableYears }
}

/**
 * Parses the year in the URL of the wizard. Returns `null` when it is not four digits or not one
 * of the years that can be planned.
 */
export function parsePlanYear(value: string | undefined, availableYears: number[]): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null
  const year = Number(value)
  return availableYears.includes(year) ? year : null
}

/**
 * Returns the years the wizard can plan at most: the current year and the next year
 * (Europe/Amsterdam). Child routes use it to reject a year before querying; the layout checks
 * the years that can actually be planned for the farm.
 */
export function getCandidatePlanYears(now: Date = new Date()): number[] {
  const currentYear = Number(toFdmDateString(now).slice(0, 4))
  return [currentYear, currentYear + 1]
}

/**
 * Returns the cultivations of the catalogues enabled for the farm that can be chosen in a year.
 *
 * The catalogue lists per cultivation the years in which its code is available (`b_lu_ya`). For a
 * year that is not in the catalogue yet, such as a year planned ahead, the newest earlier year in
 * the catalogue is used; otherwise only the few cultivations without availability years would be
 * offered. fdm-core checks the availability of a new cultivation in the same way.
 *
 * @param fdm - The FDM instance.
 * @param principal_id - The ID of the principal.
 * @param b_id_farm - The ID of the farm.
 * @param year - The year that is planned.
 * @returns The cultivations that can be chosen.
 */
export async function getCultivationCatalogueForPlanYear(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  year: number,
): Promise<CultivationCatalogue[]> {
  const catalogue = await getCultivationsFromCatalogue(fdm, principal_id, b_id_farm)
  let catalogueYear: number | undefined
  for (const entry of catalogue) {
    for (const available of entry.b_lu_ya ?? []) {
      if (available <= year && (catalogueYear === undefined || available > catalogueYear)) {
        catalogueYear = available
      }
    }
  }
  const selectedYear = catalogueYear ?? year
  return catalogue.filter(
    (entry) => !entry.b_lu_ya || entry.b_lu_ya.length === 0 || entry.b_lu_ya.includes(selectedYear),
  )
}
