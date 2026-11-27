/* eslint-disable typescript/restrict-template-expressions -- Number, Decimal, and string union literals are intentionally formatted in template strings and serialize safely. */
import type { FdmType, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
  getCultivations,
  getCultivationsForFarm,
  getFertilizerApplications,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getField,
  getFields,
  getGrazingIntention,
  isOrganicCertificationValid,
} from "@nmi-agro/fdm-core"
import type { NL2026NormsYear } from "../value/types"
import type { NL2026NormsFillingInput } from "./types"

/**
 * Returns the timeframe of a norm year, from 1 January until the end of 31 December.
 *
 * @param year - The norm year.
 * @returns The timeframe to collect the cultivations and applications with.
 */
function getNormYearTimeframe(year: NL2026NormsYear): Timeframe {
  return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) }
}

/**
 * Collects all necessary input data from fdm-core functions for the NL norms filling calculations
 * of a norm year that uses the rules introduced in 2026.
 * This function standardizes the data collection process, ensuring all calculation functions
 * receive a unified input object (NL2026NormsFillingInput).
 *
 * @param {FdmType} fdm - The FdmType instance for interacting with the Farm Data Model.
 * @param {string} principal_id - The ID of the principal (user or organization) performing the calculation.
 * @param {string} b_id - The ID of the field for which the norms are being calculated.
 * @param {number} fosfaatgebruiksnorm - The phosphate usage norm in kg/ha for the current calculation.
 * @param year - The norm year.
 * @returns {Promise<NL2026NormsFillingInput>} A promise that resolves to a standardized input object
 *   containing cultivations, fertilizer applications, fertilizers, organic certification status,
 *   grazing intention status, the phosphate usage norm, and the field's centroid.
 * @throws {Error} Throws an error if the specified field cannot be found.
 */
export async function collectNL2026InputForFertilizerApplicationFilling(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id: string,
  fosfaatgebruiksnorm: number,
  year: NL2026NormsYear,
): Promise<NL2026NormsFillingInput> {
  // The timeframe for data collection of the norm year.
  const timeframeYear = getNormYearTimeframe(year)

  // 1. Retrieve field details using the field ID.
  // This is crucial for obtaining the farm ID and the field's geographical centroid.
  const field = await getField(fdm, principal_id, b_id)
  if (!field) {
    throw new Error(`Field with id ${b_id} not found for principal ${principal_id}`)
  }
  const b_id_farm = field.b_id_farm
  const b_centroid = field.b_centroid

  // 2. Retrieve the grazing intention status for the farm for the specified year.
  // This indicates whether grazing is intended on the farm, affecting certain norm calculations.
  const has_grazing_intention = await getGrazingIntention(fdm, principal_id, b_id_farm, year)

  // 3. Check the organic certification status for the farm.
  // This is relevant for specific organic-rich fertilizer regulations.
  // The date is set to mid-year to ensure it falls within the certification period if applicable.
  const has_organic_certification = await isOrganicCertificationValid(
    fdm,
    principal_id,
    b_id_farm,
    new Date(year, 4, 15), // May 15th of the specified year
  )

  // 4. Retrieve all cultivations associated with the field within the defined cultivation timeframe.
  // This data is used to determine land use (e.g., bouwland/grasland).
  const cultivations = await getCultivations(fdm, principal_id, b_id, timeframeYear)

  // 5. Retrieve all fertilizer applications for the farm within the current year's timeframe.
  const applications = await getFertilizerApplications(fdm, principal_id, b_id, timeframeYear)
  // 6. Retrieve details of all fertilizers used on the farm.
  const fertilizers = await getFertilizers(fdm, principal_id, b_id_farm)

  // Assemble all collected data into the standardized NL2026NormsFillingInput object.
  return {
    cultivations: cultivations,
    applications: applications,
    fertilizers: fertilizers,
    has_organic_certification: has_organic_certification,
    has_grazing_intention: has_grazing_intention,
    fosfaatgebruiksnorm: fosfaatgebruiksnorm,
    b_centroid: b_centroid,
  }
}

/**
 * Collects all necessary input data for the NL norms filling of a norm year that uses the rules
 * introduced in 2026, for every field on a farm.
 *
 * Farm-level data (`getGrazingIntention`, `isOrganicCertificationValid`, `getFertilizers`) is
 * fetched once. Per-field data (`getCultivations`, `getFertilizerApplications`) is fetched in
 * two farm-level queries.
 *
 * @param fdm - The FdmType instance for interacting with the Farm Data Model.
 * @param principal_id - The ID of the principal performing the calculation.
 * @param b_id_farm - The ID of the farm for which to collect data.
 * @param fosfaatgebruiksnormByField - A Map from field ID to the phosphate usage norm (kg/ha) for that field.
 * @param year - The norm year.
 * @returns A promise that resolves to a `Map<b_id, NL2026NormsFillingInput>` keyed by field ID.
 */
export async function collectNL2026InputForFertilizerApplicationFillingForFarm(
  fdm: FdmType,
  principal_id: PrincipalId,
  b_id_farm: string,
  fosfaatgebruiksnormByField: Map<string, number>,
  year: NL2026NormsYear,
): Promise<Map<string, NL2026NormsFillingInput>> {
  const timeframeYear = getNormYearTimeframe(year)

  const [
    farmFields,
    has_grazing_intention,
    has_organic_certification,
    fertilizers,
    cultivationsByField,
    applicationsByField,
  ] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm),
    getGrazingIntention(fdm, principal_id, b_id_farm, year),
    isOrganicCertificationValid(fdm, principal_id, b_id_farm, new Date(year, 4, 15)),
    getFertilizers(fdm, principal_id, b_id_farm),
    getCultivationsForFarm(fdm, principal_id, b_id_farm, timeframeYear),
    getFertilizerApplicationsForFarm(fdm, principal_id, b_id_farm, timeframeYear),
  ])

  const result = new Map<string, NL2026NormsFillingInput>()
  for (const field of farmFields) {
    result.set(field.b_id, {
      cultivations: cultivationsByField.get(field.b_id) ?? [],
      applications: applicationsByField.get(field.b_id) ?? [],
      fertilizers,
      has_organic_certification,
      has_grazing_intention,
      fosfaatgebruiksnorm: fosfaatgebruiksnormByField.get(field.b_id) ?? 0,
      b_centroid: field.b_centroid,
    })
  }
  return result
}
