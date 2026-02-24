import type { FdmType, PrincipalId, Timeframe } from "@nmi-agro/fdm-core"
import {
    getCultivations,
    getFertilizerApplications,
    getFertilizers,
    getField,
    getGrazingIntention,
    isOrganicCertificationValid,
} from "@nmi-agro/fdm-core"
import type { NL2025NormsFillingInput } from "./types"

/**
 * Collects all necessary input data from fdm-core functions for the NL 2025 norms filling calculations.
 * This function standardizes the data collection process, ensuring all calculation functions
 * receive a unified input object (NL2025NormsFillingInput).
 *
 * @param {FdmType} fdm - The FdmType instance for interacting with the Farm Data Model.
 * @param {string} principal_id - The ID of the principal (user or organization) performing the calculation.
 * @param {string} b_id - The ID of the field for which the norms are being calculated.
 * @param {number} fosfaatgebruiksnorm - The phosphate usage norm in kg/ha for the current calculation.
 * @returns {Promise<NL2025NormsFillingInput>} A promise that resolves to a standardized input object
 *   containing cultivations, fertilizer applications, fertilizers, organic certification status,
 *   grazing intention status, the phosphate usage norm, and the field's centroid.
 * @throws {Error} Throws an error if the specified field cannot be found.
 */
export async function collectNL2025InputForFertilizerApplicationFilling(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: string,
    fosfaatgebruiksnorm: number,
): Promise<NL2025NormsFillingInput> {
    // Define the calendar year for the norms calculation.
    const year = 2025
    // Define the timeframe for data collection for the current year.
    const startOfYear = new Date(year, 0, 1) // January 1st of the specified year
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999) // December 31st of the specified year, including December 31st
    const timeframe2025: Timeframe = { start: startOfYear, end: endOfYear }

    // 1. Retrieve field details using the field ID.
    // This is crucial for obtaining the farm ID and the field's geographical centroid.
    const field = await getField(fdm, principal_id, b_id)
    if (!field) {
        throw new Error(
            `Field with id ${b_id} not found for principal ${principal_id}`,
        )
    }
    const b_id_farm = field.b_id_farm
    const b_centroid = field.b_centroid

    // 2. Retrieve the grazing intention status for the farm for the specified year.
    // This indicates whether grazing is intended on the farm, affecting certain norm calculations.
    const has_grazing_intention = await getGrazingIntention(
        fdm,
        principal_id,
        b_id_farm,
        year,
    )

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
    const cultivations = await getCultivations(
        fdm,
        principal_id,
        b_id,
        timeframe2025,
    )

    // 5. Retrieve all fertilizer applications for the farm within the current year's timeframe.
    const applications = await getFertilizerApplications(
        fdm,
        principal_id,
        b_id,
        timeframe2025,
    )
    // 6. Retrieve details of all fertilizers used on the farm.
    const fertilizers = await getFertilizers(fdm, principal_id, b_id_farm)

    // Assemble all collected data into the standardized NL2025NormsFillingInput object.
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
