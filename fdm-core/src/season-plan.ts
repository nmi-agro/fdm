/**
 * Season planning: data access for the wizard that plans the cultivations, catch crops, measures,
 * fertilizer applications and harvests of a farm for a coming (or current) year.
 *
 * There is no separate entity for a season plan. The plan of a year is the data recorded for that
 * year, and its progress is derived from that data (see `season-plan-rules.ts`).
 *
 * @module
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm"
import type { PrincipalId } from "./authorization.types"
import type { FdmType } from "./fdm.types"
import type {
  SeasonPlanData,
  SeasonPlanOptions,
  SeasonPlanProgress,
  SeasonPlanProposal,
  SeasonPlanTarget,
} from "./season-plan.types"
import { checkPermission } from "./authorization"
import { getCultivationsForFarm } from "./cultivation"
import { adjustEndDateAtYearStart } from "./date"
import * as schema from "./db/schema"
import { handleError } from "./error"
import { getFertilizerApplicationsForFarm } from "./fertilizer"
import { getFields } from "./field"
import { getHarvestsForFarm } from "./harvest"
import { createId } from "./id"
import { getMeasuresForFarm } from "./measure"
import {
  buildSeasonPlanProposal,
  evaluateSeasonPlanProgress,
  findSeasonPlanRules,
  getYearInFdmTimeZone,
  getYearTimeframe,
  resolveSeasonPlanRules,
  resolveSeasonPlanTargetFromData,
  shiftDateToYear,
} from "./season-plan-rules"

/**
 * Collects the farm data needed for the season plan of the years `fromYear` up to and including
 * `toYear`.
 */
async function collectSeasonPlanData(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  fromYear: number,
  toYear: number,
): Promise<SeasonPlanData> {
  const timeframe = {
    start: getYearTimeframe(fromYear).start,
    end: getYearTimeframe(toYear).end,
  }
  const [fields, cultivations, fertilizerApplications, harvests, measures] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframe),
    getMeasuresForFarm(fdm, principal_id, b_id_farm),
  ])
  return {
    fields: fields.map((field) => ({
      b_id: field.b_id,
      b_name: field.b_name,
      b_start: field.b_start,
      b_end: field.b_end,
      b_bufferstrip: field.b_bufferstrip ?? false,
    })),
    cultivations,
    fertilizerApplications,
    harvests,
    measures,
  }
}

/** Throws when the year is not an integer. */
function assertYear(year: number): void {
  if (!Number.isInteger(year)) {
    throw new Error(`Invalid year: ${year}`)
  }
}

/**
 * Returns the progress of the season plan of a farm for a target year.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param targetYear The year that is planned.
 * @param options Injected legal requirements, such as whether a catch crop is required on a field.
 * @returns The progress per step, the first incomplete step and the status of each field.
 * @alpha
 */
export async function getSeasonPlanProgress(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  targetYear: number,
  options: SeasonPlanOptions = {},
): Promise<SeasonPlanProgress> {
  try {
    assertYear(targetYear)
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getSeasonPlanProgress")
    const rules = resolveSeasonPlanRules(targetYear)
    const data = await collectSeasonPlanData(
      fdm,
      principal_id,
      b_id_farm,
      targetYear - 1,
      targetYear,
    )
    return evaluateSeasonPlanProgress(data, targetYear, options, rules)
  } catch (err) {
    throw handleError(err, "Exception for getSeasonPlanProgress", { b_id_farm, targetYear })
  }
}

/**
 * Determines the target year the season planning wizard opens by default: the current year when
 * its plan is not complete yet, else the next year. When both are complete the next year is
 * returned, so the wizard stays accessible.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param options Injected legal requirements and the moment used as "now".
 * @returns The default target year and the years that can be chosen, or `null` when the farm has
 *   no main cultivations in the history years to plan from.
 * @alpha
 */
export async function resolveSeasonPlanTarget(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  options: SeasonPlanOptions = {},
): Promise<SeasonPlanTarget | null> {
  try {
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "resolveSeasonPlanTarget")
    const currentYear = getYearInFdmTimeZone(options.now ?? new Date())
    const applicable = [currentYear, currentYear + 1]
      .map((year) => findSeasonPlanRules(year))
      .filter((rules) => rules !== null)
    if (applicable.length === 0) return null
    const historyYears = Math.max(...applicable.map((rules) => rules.historyYears))
    const data = await collectSeasonPlanData(
      fdm,
      principal_id,
      b_id_farm,
      currentYear - historyYears,
      currentYear + 1,
    )
    return resolveSeasonPlanTargetFromData(data, currentYear, options)
  } catch (err) {
    throw handleError(err, "Exception for resolveSeasonPlanTarget", { b_id_farm })
  }
}

/**
 * Returns the proposal of the season plan of a farm for a target year: for each field its
 * history, type (permanent, rotation or new), source year, proposed main cultivation, rotation
 * warnings, fertilizer template and measures, and the fields that are no longer available.
 *
 * Nothing is written. The wizard writes the parts of the proposal that the user confirms.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_farm The ID of the farm.
 * @param targetYear The year that is planned.
 * @param sourceYears Source years chosen by the user per field (`b_id`).
 * @returns The proposal.
 * @alpha
 */
export async function getSeasonPlanProposal(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  targetYear: number,
  sourceYears: Map<string, number> = new Map(),
): Promise<SeasonPlanProposal> {
  try {
    assertYear(targetYear)
    await checkPermission(fdm, "farm", "read", b_id_farm, principal_id, "getSeasonPlanProposal")
    const rules = resolveSeasonPlanRules(targetYear)
    const data = await collectSeasonPlanData(
      fdm,
      principal_id,
      b_id_farm,
      targetYear - rules.historyYears,
      targetYear,
    )
    return buildSeasonPlanProposal(data, targetYear, sourceYears, rules)
  } catch (err) {
    throw handleError(err, "Exception for getSeasonPlanProposal", { b_id_farm, targetYear })
  }
}

/**
 * Copies the fertilizer applications of a field in a source year to a field in a target year.
 *
 * Each application keeps its fertilizer, amount (kg/ha) and method; its date is moved to the same
 * calendar date in the target year (29 February becomes 28 February in other years). Applications
 * that already exist on the target field with the same fertilizer and date are skipped, so calling
 * this function twice does not create duplicates.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id_source The field to copy from.
 * @param b_id_target The field to copy to. Can be the same as `b_id_source`.
 * @param sourceYear The year to copy from.
 * @param targetYear The year to copy to.
 * @param p_app_ids Optional selection of applications of the source field to copy.
 * @returns The IDs of the new applications.
 * @throws {Error} If the fields belong to different farms.
 * @alpha
 */
export async function copyFertilizerApplications(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_source: string,
  b_id_target: string,
  sourceYear: number,
  targetYear: number,
  p_app_ids?: string[],
): Promise<string[]> {
  try {
    assertYear(sourceYear)
    assertYear(targetYear)
    await checkPermission(
      fdm,
      "field",
      "read",
      b_id_source,
      principal_id,
      "copyFertilizerApplications",
    )
    await checkPermission(
      fdm,
      "field",
      "write",
      b_id_target,
      principal_id,
      "copyFertilizerApplications",
    )

    return await fdm.transaction(async (tx) => {
      const farms = await tx
        .select({ b_id: schema.fieldAcquiring.b_id, b_id_farm: schema.fieldAcquiring.b_id_farm })
        .from(schema.fieldAcquiring)
        .where(inArray(schema.fieldAcquiring.b_id, [b_id_source, b_id_target]))
      const farmIds = new Set(farms.map((row) => row.b_id_farm))
      if (farmIds.size !== 1 || farms.length !== new Set([b_id_source, b_id_target]).size) {
        throw new Error("Source and target field must belong to the same farm")
      }

      const source = getYearTimeframe(sourceYear)
      const target = getYearTimeframe(targetYear)
      const sourceApplications = await tx
        .select({
          p_app_id: schema.fertilizerApplication.p_app_id,
          p_id: schema.fertilizerApplication.p_id,
          p_app_amount: schema.fertilizerApplication.p_app_amount,
          p_app_method: schema.fertilizerApplication.p_app_method,
          p_app_date: schema.fertilizerApplication.p_app_date,
        })
        .from(schema.fertilizerApplication)
        .where(
          and(
            eq(schema.fertilizerApplication.b_id, b_id_source),
            gte(schema.fertilizerApplication.p_app_date, source.start),
            lte(schema.fertilizerApplication.p_app_date, source.end),
            p_app_ids ? inArray(schema.fertilizerApplication.p_app_id, p_app_ids) : undefined,
          ),
        )
      const existing = await tx
        .select({
          p_id: schema.fertilizerApplication.p_id,
          p_app_date: schema.fertilizerApplication.p_app_date,
        })
        .from(schema.fertilizerApplication)
        .where(
          and(
            eq(schema.fertilizerApplication.b_id, b_id_target),
            gte(schema.fertilizerApplication.p_app_date, target.start),
            lte(schema.fertilizerApplication.p_app_date, target.end),
          ),
        )
      const existingKeys = new Set(
        existing.map((row) => `${row.p_id}|${row.p_app_date?.getTime()}`),
      )

      const inserted: string[] = []
      for (const application of sourceApplications) {
        if (!application.p_app_date) continue
        const p_app_date = shiftDateToYear(application.p_app_date, targetYear)
        const key = `${application.p_id}|${p_app_date.getTime()}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)
        const p_app_id = createId()
        await tx.insert(schema.fertilizerApplication).values({
          p_app_id,
          b_id: b_id_target,
          p_id: application.p_id,
          p_app_amount: application.p_app_amount,
          p_app_method: application.p_app_method,
          p_app_date,
        })
        inserted.push(p_app_id)
      }
      return inserted
    })
  } catch (err) {
    throw handleError(err, "Exception for copyFertilizerApplications", {
      b_id_source,
      b_id_target,
      sourceYear,
      targetYear,
    })
  }
}

/**
 * Ends the measures of a field that continue after a given date, for example when the field is no
 * longer available in the next year.
 *
 * Measures without an end date, or with an end date after `m_end`, get `m_end` as end date.
 * Measures that start after `m_end` cannot be ended at that date; they are left unchanged and
 * returned separately, so the caller can ask the user what to do with them.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param principal_id The ID of the principal making the request.
 * @param b_id The ID of the field.
 * @param m_end The last day the measures are applied (inclusive, Europe/Amsterdam).
 * @returns The IDs of the ended measures and of the measures that start after `m_end`.
 * @alpha
 */
export async function closeOngoingMeasuresOfField(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  m_end: Date,
): Promise<{ closed: string[]; startingAfterEnd: string[] }> {
  try {
    if (!(m_end instanceof Date) || Number.isNaN(m_end.getTime())) {
      throw new Error("Invalid end date")
    }
    await checkPermission(fdm, "field", "write", b_id, principal_id, "closeOngoingMeasuresOfField")
    const end = adjustEndDateAtYearStart(m_end)

    return await fdm.transaction(async (tx) => {
      const rows = await tx
        .select({
          b_id_measure: schema.measureAdopting.b_id_measure,
          m_start: schema.measureAdopting.m_start,
          m_end: schema.measureAdopting.m_end,
        })
        .from(schema.measureAdopting)
        .where(eq(schema.measureAdopting.b_id, b_id))

      const closed: string[] = []
      const startingAfterEnd: string[] = []
      const updated = new Date()
      for (const row of rows) {
        if (row.m_end && adjustEndDateAtYearStart(row.m_end).getTime() <= end.getTime()) continue
        if (row.m_start && row.m_start.getTime() > end.getTime()) {
          startingAfterEnd.push(row.b_id_measure)
          continue
        }
        await tx
          .update(schema.measureAdopting)
          .set({ m_end, updated })
          .where(
            and(
              eq(schema.measureAdopting.b_id, b_id),
              eq(schema.measureAdopting.b_id_measure, row.b_id_measure),
            ),
          )
        closed.push(row.b_id_measure)
      }
      return { closed, startingAfterEnd }
    })
  } catch (err) {
    throw handleError(err, "Exception for closeOngoingMeasuresOfField", { b_id, m_end })
  }
}
