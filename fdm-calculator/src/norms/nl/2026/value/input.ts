import {
  type FdmType,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getField,
  getFields,
  getGrazingIntention,
  getHarvests,
  getHarvestsForFarm,
  type Harvest,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import type { NL2026NormsInput, NL2026NormsYear } from "./types.d"

export type NL2026FdmCoreOperations = {
  getField: typeof getField
  getFields: typeof getFields
  getCultivations: typeof getCultivations
  getCultivationsForFarm: typeof getCultivationsForFarm
  getCurrentSoilData: typeof getCurrentSoilData
  getCurrentSoilDataForFarm: typeof getCurrentSoilDataForFarm
  getGrazingIntention: typeof getGrazingIntention
  getHarvests: typeof getHarvests
  getHarvestsForFarm: typeof getHarvestsForFarm
}

export type NL2026SingleFdmCoreOperations = Pick<
  NL2026FdmCoreOperations,
  "getField" | "getCultivations" | "getHarvests" | "getCurrentSoilData" | "getGrazingIntention"
>

export type NL2026FarmFdmCoreOperations = Pick<
  NL2026FdmCoreOperations,
  | "getFields"
  | "getCultivationsForFarm"
  | "getHarvestsForFarm"
  | "getCurrentSoilDataForFarm"
  | "getGrazingIntention"
>

const defaultOperations: NL2026FdmCoreOperations = {
  getField,
  getFields,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getGrazingIntention,
  getHarvests,
  getHarvestsForFarm,
}

/**
 * Reduces harvest records to the fields needed for the norm calculation.
 *
 * @param harvests - Harvest records of a cultivation.
 * @returns The harvest dates, one entry per harvest.
 */
function pickHarvestDates(harvests: Harvest[]): Pick<Harvest, "b_lu_harvest_date">[] {
  return harvests.map(({ b_lu_harvest_date }) => ({ b_lu_harvest_date }))
}

/**
 * The timeframes of a norm year: the year itself, its harvests (until the end of 31 December) and
 * the cultivations (from 1 January of the previous year, for the cultivation history).
 *
 * @param year - The norm year.
 * @returns The timeframes to collect the input with.
 */
function getNormYearTimeframes(year: NL2026NormsYear): {
  timeframeYear: Timeframe
  timeframeHarvests: Timeframe
  timeframeCultivation: Timeframe
} {
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)
  // Dates are timestamps: include everything on 31 December, not only what starts at midnight
  const endOfLastDay = new Date(year, 11, 31, 23, 59, 59, 999)
  return {
    timeframeYear: { start: startOfYear, end: endOfYear },
    timeframeHarvests: { start: startOfYear, end: endOfLastDay },
    timeframeCultivation: { start: new Date(year - 1, 0, 1), end: endOfLastDay },
  }
}

/**
 * Collects all necessary input data from the FDM to calculate the Dutch (NL) norms of a norm year
 * that uses the rules introduced in 2026.
 *
 * This function orchestrates fetching data for a given farm, its fields, cultivations (with their
 * harvests in the norm year), and soil analyses,
 * and structures it into a format suitable for the NL norm calculation functions from 2026 on.
 *
 * @param fdm - An initialized FdmType instance for data access.
 * @param principal_id - The ID of the principal initiating the data collection.
 * @param b_id - The unique identifier of the field for which to collect data.
 * @param year - The norm year.
 * @param operations - The fdm-core functions to read the data with (replaceable in tests).
 * @returns A promise that resolves to an `NL2026NormsInput` object, containing all the
 *   structured data required for the norm calculations.
 */
export async function collectNL2026InputForNorms(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  year: NL2026NormsYear,
  operations: NL2026SingleFdmCoreOperations = defaultOperations,
): Promise<NL2026NormsInput> {
  const { timeframeYear, timeframeHarvests, timeframeCultivation } = getNormYearTimeframes(year)

  // 1. Get the details for the field.
  const field = await operations.getField(fdm, principal_id, b_id)

  // 2. Get the grazing intention for the farm
  const has_grazing_intention = await operations.getGrazingIntention(
    fdm,
    principal_id,
    field.b_id_farm,
    year,
  )

  // 3. Get the details of the cultivations
  const cultivations = await operations.getCultivations(
    fdm,
    principal_id,
    b_id,
    timeframeCultivation,
  )

  // Attach the harvests within the norm year, to tell eenmalige from meermalige oogst
  const cultivationsWithHarvests = await Promise.all(
    cultivations.map(async (cultivation) => {
      const harvests = await operations.getHarvests(
        fdm,
        principal_id,
        cultivation.b_lu,
        timeframeHarvests,
      )
      return { ...cultivation, harvests: pickHarvestDates(harvests) }
    }),
  )

  // 4. Get the details of the soil analyses
  const soilAnalysis = await operations.getCurrentSoilData(
    fdm,
    principal_id,
    field.b_id,
    timeframeYear,
  )
  const soilAnalysisPicked = {
    a_p_cc:
      (soilAnalysis.find((x: { parameter: string }) => x.parameter === "a_p_cc")?.value as
        | number
        | null
        | undefined) ?? null,
    a_p_al:
      (soilAnalysis.find((x: { parameter: string }) => x.parameter === "a_p_al")?.value as
        | number
        | null
        | undefined) ?? null,
  }

  return {
    year,
    farm: {
      has_grazing_intention,
    },
    field: field,
    cultivations: cultivationsWithHarvests,
    soilAnalysis: soilAnalysisPicked,
  }
}

/**
 * Collects all necessary input data for the NL norms of a norm year that uses the rules introduced
 * in 2026, for every field on a farm.
 *
 * Farm-level data (`getGrazingIntention`) is fetched once. Per-field data
 * (`getCultivations`, `getHarvests`, `getCurrentSoilData`) is fetched in three farm-level queries.
 * Harvests are limited to the norm year and attached to each cultivation by `b_lu`.
 *
 * @param fdm - An initialized FdmType instance for data access.
 * @param principal_id - The ID of the principal initiating the data collection.
 * @param b_id_farm - The unique identifier of the farm.
 * @param year - The norm year.
 * @param operations - The fdm-core functions to read the data with (replaceable in tests).
 * @returns A promise that resolves to a `Map<b_id, NL2026NormsInput>` keyed by field ID.
 */
export async function collectNL2026InputForNormsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  year: NL2026NormsYear,
  operations: NL2026FarmFdmCoreOperations = defaultOperations,
): Promise<Map<string, NL2026NormsInput>> {
  const { timeframeYear, timeframeHarvests, timeframeCultivation } = getNormYearTimeframes(year)

  const [
    farmFields,
    has_grazing_intention,
    cultivationsByField,
    harvestsByCultivation,
    soilDataByField,
  ] = await Promise.all([
    operations.getFields(fdm, principal_id, b_id_farm, timeframeCultivation),
    operations.getGrazingIntention(fdm, principal_id, b_id_farm, year),
    operations.getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframeCultivation),
    operations.getHarvestsForFarm(fdm, principal_id, b_id_farm, timeframeHarvests),
    operations.getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframeYear),
  ])

  const result = new Map<string, NL2026NormsInput>()
  for (const field of farmFields) {
    const soilAnalysis = soilDataByField.get(field.b_id) ?? []
    const soilAnalysisPicked = {
      a_p_cc:
        ((Array.isArray(soilAnalysis)
          ? soilAnalysis.find((x: { parameter: string }) => x.parameter === "a_p_cc")?.value
          : null) as number | null) ?? null,
      a_p_al:
        ((Array.isArray(soilAnalysis)
          ? soilAnalysis.find((x: { parameter: string }) => x.parameter === "a_p_al")?.value
          : null) as number | null) ?? null,
    }
    result.set(field.b_id, {
      year,
      farm: { has_grazing_intention },
      field,
      cultivations: (cultivationsByField.get(field.b_id) ?? []).map((cultivation) => ({
        ...cultivation,
        harvests: pickHarvestDates(harvestsByCultivation.get(cultivation.b_lu) ?? []),
      })),
      soilAnalysis: soilAnalysisPicked,
    })
  }
  return result
}
