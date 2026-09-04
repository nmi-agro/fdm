import {
  type FdmType,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getField,
  getFields,
  getGrazingIntention,
  isDerogationGrantedForYear,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import type { NL2025NormsInput } from "./types.d"

export type NL2025FdmCoreOperations = {
  getField: typeof getField
  getFields: typeof getFields
  getCultivations: typeof getCultivations
  getCultivationsForFarm: typeof getCultivationsForFarm
  getCurrentSoilData: typeof getCurrentSoilData
  getCurrentSoilDataForFarm: typeof getCurrentSoilDataForFarm
  getGrazingIntention: typeof getGrazingIntention
  isDerogationGrantedForYear: typeof isDerogationGrantedForYear
}

export type NL2025SingleFdmCoreOperations = Pick<
  NL2025FdmCoreOperations,
  | "getField"
  | "getCultivations"
  | "getCurrentSoilData"
  | "getGrazingIntention"
  | "isDerogationGrantedForYear"
>

export type NL2025FarmFdmCoreOperations = Pick<
  NL2025FdmCoreOperations,
  | "getFields"
  | "getCultivationsForFarm"
  | "getCurrentSoilDataForFarm"
  | "getGrazingIntention"
  | "isDerogationGrantedForYear"
>

const defaultOperations: NL2025FdmCoreOperations = {
  getField,
  getFields,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getCurrentSoilDataForFarm,
  getGrazingIntention,
  isDerogationGrantedForYear,
}

/**
 * Collects all necessary input data from the FDM to calculate the Dutch (NL) norms for the year 2025.
 *
 * This function orchestrates fetching data for a given farm, its fields, cultivations, and soil analyses,
 * and structures it into a format suitable for the various NL 2025 norm calculation functions.
 *
 * @param fdm - An initialized FdmType instance for data access.
 * @param principal_id - The ID of the principal initiating the data collection.
 * @param b_id - The unique identifier of the field for which to collect data.
 * @returns A promise that resolves to an `NL2025NormsInput` object, containing all the
 *   structured data required for the norm calculations.
 */
export async function collectNL2025InputForNorms(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  operations: NL2025SingleFdmCoreOperations = defaultOperations,
): Promise<NL2025NormsInput> {
  // Create timeframe for 2025
  const year = 2025
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)
  const timeframe2025: Timeframe = { start: startOfYear, end: endOfYear }
  const timeframe2025Cultivation: Timeframe = {
    start: new Date(year - 1, 0, 1),
    end: endOfYear,
  }

  // 1. Get the details for the field.
  const field = await operations.getField(fdm, principal_id, b_id)

  // 2. Get the details for the farm
  const is_derogatie_bedrijf = await operations.isDerogationGrantedForYear(
    fdm,
    principal_id,
    field.b_id_farm,
    2025,
  )

  // 3. Get the grazing intention for the farm
  const has_grazing_intention = await operations.getGrazingIntention(
    fdm,
    principal_id,
    field.b_id_farm,
    2025,
  )

  // 4. Get the details of the cultivations
  const cultivations = await operations.getCultivations(
    fdm,
    principal_id,
    b_id,
    timeframe2025Cultivation,
  )

  // 4. Get the details of the soil analyses
  const soilAnalysis = await operations.getCurrentSoilData(
    fdm,
    principal_id,
    field.b_id,
    timeframe2025,
  )
  const soilAnalysisPicked = {
    a_p_cc:
      (soilAnalysis.find((x: { parameter: string }) => x.parameter === "a_p_cc")?.value as
        | number
        | null) ?? null,
    a_p_al:
      (soilAnalysis.find((x: { parameter: string }) => x.parameter === "a_p_al")?.value as
        | number
        | null) ?? null,
  }

  return {
    farm: {
      is_derogatie_bedrijf,
      has_grazing_intention,
    },
    field: field,
    cultivations: cultivations,
    soilAnalysis: soilAnalysisPicked,
  }
}

/**
 * Collects all necessary input data for the NL 2025 norms for every field on a farm.
 *
 * Farm-level data (`isDerogationGrantedForYear`, `getGrazingIntention`) is fetched once.
 * Per-field data (`getCultivations`, `getCurrentSoilData`) is fetched in two farm-level queries.
 *
 * @param fdm - An initialized FdmType instance for data access.
 * @param principal_id - The ID of the principal initiating the data collection.
 * @param b_id_farm - The unique identifier of the farm.
 * @returns A promise that resolves to a `Map<b_id, NL2025NormsInput>` keyed by field ID.
 */
export async function collectNL2025InputForNormsForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  operations: NL2025FarmFdmCoreOperations = defaultOperations,
): Promise<Map<string, NL2025NormsInput>> {
  const year = 2025
  const startOfYear = new Date(year, 0, 1)
  const endOfYear = new Date(year, 11, 31)
  const timeframe2025: Timeframe = { start: startOfYear, end: endOfYear }
  const timeframe2025Cultivation: Timeframe = {
    start: new Date(year - 1, 0, 1),
    end: endOfYear,
  }

  const [
    farmFields,
    is_derogatie_bedrijf,
    has_grazing_intention,
    cultivationsByField,
    soilDataByField,
  ] = await Promise.all([
    operations.getFields(fdm, principal_id, b_id_farm, timeframe2025Cultivation),
    operations.isDerogationGrantedForYear(fdm, principal_id, b_id_farm, year),
    operations.getGrazingIntention(fdm, principal_id, b_id_farm, year),
    operations.getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframe2025Cultivation),
    operations.getCurrentSoilDataForFarm(fdm, principal_id, b_id_farm, timeframe2025),
  ])

  const result = new Map<string, NL2025NormsInput>()
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
      farm: { is_derogatie_bedrijf, has_grazing_intention },
      field,
      cultivations: cultivationsByField.get(field.b_id) ?? [],
      soilAnalysis: soilAnalysisPicked,
    })
  }
  return result
}
