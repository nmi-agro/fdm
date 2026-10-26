/**
 * @packageDocumentation
 * @module mineralization/scenario
 *
 * What-if scenarios: changes to the fertilization plan and the harvest that are calculated with
 * Dyna before they are saved.
 */

import { type Fertilizer, toFdmDateString, toKgPerHa } from "@nmi-agro/fdm-core"
import { z } from "zod"
import type { DynaV2Request } from "./types"
import {
  buildFertilizerProperties,
  type MineralizationApplication,
  type MineralizationCultivation,
  type MineralizationFertilizer,
  DYNA_V2_MAX_HARVESTS_PER_CULTIVATION,
  mapApplicationMethod,
} from "./prepare"

/** Fertilizer application in a scenario. Amounts are in the display unit of the fertilizer. */
export interface ScenarioFertilizerApplication {
  /** Identifier of an existing application; absent for new applications. */
  p_app_id?: string
  p_id: string
  /** Amount in the display unit of the fertilizer (`p_app_amount_unit`). */
  p_app_amount_display: number
  p_app_method: string
  /** Calendar date (`YYYY-MM-DD`). */
  p_app_date: string
}

/** Harvest of the main cultivation in a scenario. */
export interface ScenarioHarvest {
  /** Identifier of an existing harvest; absent for new harvests. */
  b_id_harvesting?: string
  /** Calendar date (`YYYY-MM-DD`). */
  b_date_harvest: string
  /** Yield in kg DM/ha; absent when unknown. */
  b_lu_yield?: number
}

/**
 * Scenario for one field: the full list of applications in the year and the harvests of the main
 * cultivation in the year (one for a crop harvested once, the cuts for grassland).
 */
export interface MineralizationScenario {
  fertilizerApplications: ScenarioFertilizerApplication[]
  /** Harvests of the main cultivation; absent to keep the current harvests. */
  harvests?: ScenarioHarvest[]
}

/** Fertilizer properties needed to calculate a scenario. */
export type ScenarioFertilizer = MineralizationFertilizer &
  Pick<Fertilizer, "p_app_amount_unit" | "p_density">

/** Changes needed to save a scenario. */
export interface ScenarioDiff {
  add: ScenarioFertilizerApplication[]
  update: (ScenarioFertilizerApplication & { p_app_id: string })[]
  /** `p_app_id` of the applications to remove. */
  remove: string[]
  /** Harvests of the main cultivation to add, update and remove (`b_id_harvesting`). */
  harvests: {
    add: ScenarioHarvest[]
    update: (ScenarioHarvest & { b_id_harvesting: string })[]
    remove: string[]
  }
}

/**
 * Returns the schema that validates a scenario for a calendar year.
 *
 * Dates must be `YYYY-MM-DD` within the year and amounts must not be negative. A scenario has at
 * least one and at most {@link DYNA_V2_MAX_HARVESTS_PER_CULTIVATION} harvests.
 *
 * @param year - Calendar year of the scenario.
 * @returns Zod schema of {@link MineralizationScenario}.
 */
export function getMineralizationScenarioSchema(year: number) {
  const dateInYear = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ongeldige datum")
    .refine((date) => date.startsWith(`${year}-`), `De datum moet in ${year} liggen`)
  return z.object({
    fertilizerApplications: z.array(
      z.object({
        p_app_id: z.string().optional(),
        p_id: z.string().min(1),
        p_app_amount_display: z.number().min(0),
        p_app_method: z.string().min(1),
        p_app_date: dateInYear,
      }),
    ),
    harvests: z
      .array(
        z.object({
          b_id_harvesting: z.string().min(1).optional(),
          b_date_harvest: dateInYear,
          b_lu_yield: z.number().min(0).optional(),
        }),
      )
      .min(1)
      .max(DYNA_V2_MAX_HARVESTS_PER_CULTIVATION)
      .optional(),
  })
}

/**
 * Applies a scenario to a prepared Dyna v2 request.
 *
 * The fertilizer applications of the request are replaced by those of the scenario (converted to
 * kg/ha). When the scenario contains harvests, they replace the harvests of the main cultivation;
 * an existing harvest keeps its other properties (such as its nitrogen content), a new one takes
 * over the crop residue setting of the cultivation. For crops harvested once, the cultivation then
 * ends on the last harvest.
 *
 * @param args.request - Request prepared with `prepareMineralizationInput`.
 * @param args.scenario - Scenario to apply.
 * @param args.fertilizers - Fertilizers of the farm by `p_id`.
 * @param args.mainB_lu - `b_lu` of the main cultivation.
 * @param args.mainHarvestable - Whether the main cultivation is harvested once or multiple times.
 * @param args.mainHarvestIds - `b_id_harvesting` of the main cultivation's harvests in the request,
 *   in the same order, to recognise existing harvests in the scenario.
 * @returns A new request; the input is not modified.
 * @throws `Error` when the scenario uses a fertilizer that is not known on the farm.
 */
export function applyScenarioToRequest(args: {
  request: DynaV2Request
  scenario: MineralizationScenario
  fertilizers: Map<string, ScenarioFertilizer>
  mainB_lu: string
  mainHarvestable: MineralizationCultivation["b_lu_harvestable"]
  mainHarvestIds?: string[]
}): DynaV2Request {
  const { request, scenario, fertilizers, mainB_lu, mainHarvestable } = args
  const result: DynaV2Request = { ...request }

  const applications = [...scenario.fertilizerApplications].sort((a, b) =>
    a.p_app_date.localeCompare(b.p_app_date),
  )
  const properties = new Map<string, NonNullable<DynaV2Request["fertilizer_properties"]>[number]>()
  result.fertilizer_applications = applications.map((application) => {
    const fertilizer = fertilizers.get(application.p_id)
    if (!fertilizer) throw new Error(`Onbekende meststof: ${application.p_id}`)
    if (!properties.has(fertilizer.p_id)) {
      properties.set(fertilizer.p_id, buildFertilizerProperties(fertilizer))
    }
    return {
      p_id: application.p_id,
      p_app_amount: toKgPerHa(
        application.p_app_amount_display,
        fertilizer.p_app_amount_unit,
        fertilizer.p_density,
      ),
      p_date_fertilization: application.p_app_date,
      p_app_method: mapApplicationMethod(application.p_app_method),
    }
  })
  result.fertilizer_properties = [...properties.values()]
  if (result.fertilizer_applications.length === 0) {
    delete result.fertilizer_applications
    delete result.fertilizer_properties
  }

  if (scenario.harvests && scenario.harvests.length > 0) {
    const harvests = request.harvests ?? []
    const mainHarvests = harvests.filter((h) => h.b_lu_id === mainB_lu)
    const existingById = new Map(
      (args.mainHarvestIds ?? []).flatMap((id, i) =>
        mainHarvests[i] ? [[id, mainHarvests[i]] as const] : [],
      ),
    )
    const cropResidue = mainHarvests.find((h) => h.m_cropresidue !== undefined)?.m_cropresidue
    const scenarioHarvests = [...scenario.harvests]
      .sort((a, b) => a.b_date_harvest.localeCompare(b.b_date_harvest))
      .map(({ b_id_harvesting, b_date_harvest, b_lu_yield }) => {
        const existing = b_id_harvesting ? existingById.get(b_id_harvesting) : undefined
        const m_cropresidue = existing ? existing.m_cropresidue : cropResidue
        // The yield of the scenario replaces the stored one, also when it was cleared
        return {
          b_lu_id: mainB_lu,
          b_date_harvest,
          ...(b_lu_yield !== undefined ? { b_lu_yield } : {}),
          ...(existing?.b_lu_n_harvestable !== undefined
            ? { b_lu_n_harvestable: existing.b_lu_n_harvestable }
            : {}),
          ...(m_cropresidue !== undefined ? { m_cropresidue } : {}),
        }
      })
    result.harvests = [...harvests.filter((h) => h.b_lu_id !== mainB_lu), ...scenarioHarvests]
    const lastHarvest = scenarioHarvests.at(-1)?.b_date_harvest
    if (mainHarvestable === "once" && lastHarvest) {
      result.cultivations = request.cultivations?.map((c) =>
        c.b_lu_id === mainB_lu ? { ...c, b_lu_end: lastHarvest } : c,
      )
    }
  }

  return result
}

/**
 * Determines which changes are needed to save a scenario.
 *
 * @param current - Current fertilizer applications of the field in the scenario's year.
 * @param currentHarvests - Current harvests of the main cultivation in the scenario's year.
 * @param scenario - Scenario to save.
 * @param base - The scenario as it was before the user edited it. When given, only applications
 *   and harvests in the base can be updated or removed, and they only count as changed when they
 *   differ from the base; those the scenario did not show are left untouched.
 * @returns Applications and harvests to add, update and remove.
 */
export function diffScenario(
  current: MineralizationApplication[],
  currentHarvests: {
    b_id_harvesting: string
    b_date_harvest: string
    b_lu_yield: number | null
  }[],
  scenario: MineralizationScenario,
  base?: MineralizationScenario,
): ScenarioDiff {
  const diff: ScenarioDiff = {
    add: [],
    update: [],
    remove: [],
    harvests: { add: [], update: [], remove: [] },
  }
  const scenarioIds = new Set<string>()
  const baseById = new Map(
    (base?.fertilizerApplications ?? []).flatMap((a) => (a.p_app_id ? [[a.p_app_id, a]] : [])),
  )

  for (const application of scenario.fertilizerApplications) {
    if (!application.p_app_id) {
      diff.add.push(application)
      continue
    }
    scenarioIds.add(application.p_app_id)
    const existing = current.find((c) => c.p_app_id === application.p_app_id)
    if (!existing) {
      diff.add.push(application)
      continue
    }
    const baseApplication = baseById.get(application.p_app_id)
    if (baseApplication) {
      // Compare with what the user started from, so values the scenario filled in for missing
      // data (e.g. a default method) do not count as a change
      const changedFromBase =
        baseApplication.p_id !== application.p_id ||
        baseApplication.p_app_amount_display !== application.p_app_amount_display ||
        baseApplication.p_app_method !== application.p_app_method ||
        baseApplication.p_app_date !== application.p_app_date
      if (changedFromBase) diff.update.push({ ...application, p_app_id: application.p_app_id })
      continue
    }
    const changed =
      existing.p_id !== application.p_id ||
      (existing.p_app_amount_display ?? existing.p_app_amount) !==
        application.p_app_amount_display ||
      (existing.p_app_method ?? "") !== application.p_app_method ||
      toFdmDateString(existing.p_app_date) !== application.p_app_date
    if (changed) diff.update.push({ ...application, p_app_id: application.p_app_id })
  }

  for (const existing of current) {
    // With a base, only applications that were part of the scenario can be removed by it
    const removable = base ? baseById.has(existing.p_app_id) : true
    if (removable && !scenarioIds.has(existing.p_app_id)) diff.remove.push(existing.p_app_id)
  }

  if (scenario.harvests) {
    const baseHarvests = new Map(
      (base?.harvests ?? []).flatMap((h) => (h.b_id_harvesting ? [[h.b_id_harvesting, h]] : [])),
    )
    const kept = new Set<string>()
    for (const harvest of scenario.harvests) {
      const existing = harvest.b_id_harvesting
        ? currentHarvests.find((h) => h.b_id_harvesting === harvest.b_id_harvesting)
        : undefined
      if (!existing) {
        const { b_id_harvesting: _id, ...added } = harvest
        diff.harvests.add.push(added)
        continue
      }
      kept.add(existing.b_id_harvesting)
      // Compare with what the user started from when known, like the applications
      const reference = baseHarvests.get(existing.b_id_harvesting)
      const changed = reference
        ? reference.b_date_harvest !== harvest.b_date_harvest ||
          reference.b_lu_yield !== harvest.b_lu_yield
        : existing.b_date_harvest !== harvest.b_date_harvest ||
          (harvest.b_lu_yield !== undefined && harvest.b_lu_yield !== existing.b_lu_yield)
      if (changed) {
        diff.harvests.update.push({ ...harvest, b_id_harvesting: existing.b_id_harvesting })
      }
    }
    for (const existing of currentHarvests) {
      // With a base, only harvests that were part of the scenario can be removed by it
      const removable = base ? baseHarvests.has(existing.b_id_harvesting) : true
      if (removable && !kept.has(existing.b_id_harvesting)) {
        diff.harvests.remove.push(existing.b_id_harvesting)
      }
    }
  }

  return diff
}
