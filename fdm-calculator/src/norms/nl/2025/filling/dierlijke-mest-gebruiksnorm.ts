import { withCalculationCache } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import pkg from "../../../../package"
import type { NormFilling } from "../../types"
import { table11Mestcodes } from "./table-11-mestcodes"
import type { NL2025NormsFillingInput } from "./types"

/**
 * Calculates the nitrogen usage from animal manure for a list of fertilizer applications.
 *
 * This function determines the contribution of each fertilizer application to the nitrogen norm
 * based on the type of manure used. It uses predefined values from `table11Mestcodes` to identify
 * which fertilizers are considered animal manure and to find their nitrogen content.
 *
 * @param {NL2025NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total nitrogen usage (`normFilling`) and a detailed breakdown per application (`applicationFilling`).
 * @throws {Error} Throws an error if a fertilizer or its RVO type is not found, ensuring data integrity.
 */
export function calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm(
    input: NL2025NormsFillingInput,
): NormFilling {
    const { applications, fertilizers } = input

    // Create maps for efficient lookups of fertilizers and RVO types.
    // This avoids iterating over the arrays repeatedly in a loop.
    const fertilizersMap = new Map(
        fertilizers.map((fertilizer) => [
            fertilizer.p_id_catalogue,
            fertilizer,
        ]),
    )
    const rvoTypeMap = new Map(
        table11Mestcodes.map((rvoType) => [rvoType.p_type_rvo, rvoType]),
    )

    // Use reduce to iterate over applications and calculate the total norm filling.
    const { totalFilling, applicationFilling } = applications.reduce(
        (acc, application) => {
            // Retrieve the fertilizer for the current application.
            const fertilizer = fertilizersMap.get(application.p_id_catalogue)
            if (!fertilizer) {
                throw new Error(
                    `Fertilizer ${application.p_id_catalogue} not found for application ${application.p_app_id}`,
                )
            }

            // Get the RVO type of the fertilizer.
            const p_type_rvo = fertilizer.p_type_rvo
            if (!p_type_rvo) {
                throw new Error(
                    `Fertilizer ${application.p_id_catalogue} has no p_type_rvo`,
                )
            }

            // Find the properties associated with the RVO type.
            const rvoTypeProperties = rvoTypeMap.get(p_type_rvo)
            if (!rvoTypeProperties) {
                throw new Error(
                    `Fertilizer ${application.p_id_catalogue} has unknown p_type_rvo ${p_type_rvo}`,
                )
            }

            let normFilling = new Decimal(0)
            // Check if the fertilizer is relevant for the nitrates directive.
            if (rvoTypeProperties.p_type_nitratesdirective) {
                const amount = new Decimal(application.p_app_amount ?? 0)
                // Determine the nitrogen content, using specific values if available, otherwise fallback to default.
                const p_n_rt = new Decimal(
                    fertilizer.p_n_rt ?? rvoTypeProperties.p_n_rt ?? 0,
                )
                // Calculate the norm filling for this application.
                normFilling = amount.times(p_n_rt).dividedBy(1000)
            }

            // Add the filling of the current application to the total.
            acc.totalFilling = acc.totalFilling.plus(normFilling)
            // Add the detailed filling for this application to the list.
            acc.applicationFilling.push({
                p_app_id: application.p_app_id,
                normFilling: normFilling.toNumber(),
            })

            return acc
        },
        // Initial value for the accumulator.
        {
            totalFilling: new Decimal(0),
            applicationFilling: [] as {
                p_app_id: string
                normFilling: number
            }[],
        },
    )

    // Return the total norm filling and the breakdown per application.
    return {
        normFilling: totalFilling.toNumber(),
        applicationFilling,
    }
}

/**
 * Memoized version of {@link calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2025NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total nitrogen usage (`normFilling`) and a detailed breakdown per application (`applicationFilling`).
 */
export const getNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm =
    withCalculationCache(
        calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm,
        "calculateNL2025FertilizerApplicationFillingForDierlijkeMestGebruiksNorm",
        pkg.calculatorVersion,
    )
