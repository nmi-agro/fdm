import {
    type FdmType,
    getCultivations,
    getCurrentSoilData,
    getField,
    getGrazingIntention,
    type PrincipalId,
    type Timeframe,
} from "@nmi-agro/fdm-core"
import type { NL2026NormsInput } from "./types.d"

/**
 * Collects all necessary input data from the FDM to calculate the Dutch (NL) norms for the year 2026.
 *
 * This function orchestrates fetching data for a given farm, its fields, cultivations, and soil analyses,
 * and structures it into a format suitable for the various NL 2026 norm calculation functions.
 *
 * @param fdm - An initialized FdmType instance for data access.
 * @param principal_id - The ID of the principal initiating the data collection.
 * @param b_id - The unique identifier of the field for which to collect data.
 * @returns A promise that resolves to an `NL2026NormsInput` object, containing all the
 *   structured data required for the norm calculations.
 */
export async function collectNL2026InputForNorms(
    fdm: FdmType,
    principal_id: PrincipalId,
    b_id: string,
): Promise<NL2026NormsInput> {
    // Create timeframe for 2026
    const year = 2026
    const startOfYear = new Date(year, 0, 1)
    const endOfYear = new Date(year, 11, 31)
    const timeframe2026: Timeframe = { start: startOfYear, end: endOfYear }
    const timeframe2026Cultivation: Timeframe = {
        start: new Date(year - 1, 0, 1),
        end: endOfYear,
    }

    // 1. Get the details for the field.
    const field = await getField(fdm, principal_id, b_id)

    // 2. Get the grazing intention for the farm
    const has_grazing_intention = await getGrazingIntention(
        fdm,
        principal_id,
        field.b_id_farm,
        2026,
    )

    // 3. Get the details of the cultivations
    const cultivations = await getCultivations(
        fdm,
        principal_id,
        b_id,
        timeframe2026Cultivation,
    )

    // 4. Get the details of the soil analyses
    const soilAnalysis = await getCurrentSoilData(
        fdm,
        principal_id,
        field.b_id,
        timeframe2026,
    )
    const soilAnalysisPicked = {
        a_p_cc: soilAnalysis.find(
            (x: { parameter: string }) => x.parameter === "a_p_cc",
        )?.value as number | null,
        a_p_al: soilAnalysis.find(
            (x: { parameter: string }) => x.parameter === "a_p_al",
        )?.value as number | null,
    }

    return {
        farm: {
            has_grazing_intention,
        },
        field: field,
        cultivations: cultivations,
        soilAnalysis: soilAnalysisPicked,
    }
}
