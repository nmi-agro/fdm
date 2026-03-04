import {
    type FdmType,
    getFertilizerApplications,
    getFertilizers,
    getField,
    type PrincipalId,
} from "@nmi-agro/fdm-core"
import { calculateDose } from "./calculate-dose"
import type { Dose } from "./d"

/**
 * Calculates the total NPK dose applied to a specific field.
 *
 * This function retrieves fertilizer applications, obtains field details to determine the associated farm ID, and fetches the properties of the fertilizers used.
 * It then computes the total NPK dose based on the collected data.
 *
 * @param fdm The FDM data object.
 * @param principal_id The identifier of the principal making the request.
 * @param b_id The ID of the field.
 * @returns A Promise resolving to the calculated NPK dose for the field.
 *
 * @throws {Error} If retrieving data or calculating the dose fails.
 */
export async function getDoseForField({
    fdm,
    principal_id,
    b_id,
}: {
    fdm: FdmType
    principal_id: PrincipalId
    b_id: string
}): Promise<Dose> {
    // Get the fertilizer applications for this field
    try {
        // Get the fertilizer applications for this field
        const applications = await getFertilizerApplications(
            fdm,
            principal_id,
            b_id,
        )

        // Get the id of the farm
        const field = await getField(fdm, principal_id, b_id)
        const farmId = field.b_id_farm

        // Get the properties of the fertilizers that are used for the applications
        const fertilizers = await getFertilizers(fdm, principal_id, farmId)

        // Calculate the dose per nutrient for this field
        const result = calculateDose({ applications, fertilizers })
        return result.dose
    } catch (error) {
        throw new Error(
            `Failed to calculate dose for field ${b_id}: ${(error as Error).message}`,
        )
    }
}
