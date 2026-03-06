import {
    type Fertilizer,
    type FertilizerApplication,
    withCalculationCache,
} from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import pkg from "../../../../package"
import type { NormFilling } from "../../types"
import { table11Mestcodes } from "./table-11-mestcodes"
import type { NL2025NormsFillingInput } from "./types"

const rvoMestcodesOrganicRich25Percent = ["111", "112"] // Compost, Zeer schone compost
const rvoMestcodesOrganicRich75Percent = ["110", "10", "61", "25", "56"] // Champost, Rundvee - Vaste mest, Geiten - Vaste mest, Paarden - Vaste mest, Schapen - Mest, alle systemen
const rvoMestcodesOrganicRich75PercentOrganic = ["40"] // Varkens - Vaste mest (for organic certification)

/**
 * Calculates the norm filling for phosphate application, taking into account the
 * "Stimuleren organische stofrijke meststoffen" (Stimulating organic-rich fertilizers) regulation.
 *
 * This regulation, detailed in Staatscourant 2023, nr. 5152, aims to encourage the use of
 * organic-rich fertilizers by applying a differentiated percentage to their phosphate content
 * when calculating against the phosphate usage norm.
 *
 * Key aspects of the regulation implemented:
 * 1.  **Minimum Threshold (Condition 1):** A discount is only applied if at least 20 kg/ha of
 *     phosphate from organic-rich fertilizers is applied.
 * 2.  **Iterative Discounting:** The differentiated percentage (25% or 75% mee) is applied
 *     iteratively. The discount is only valid for the portion of organic-rich phosphate
 *     that, when summed with other discounted organic-rich phosphate, does not exceed
 *     the `fosfaatgebruiksnorm`. Any organic-rich phosphate applied beyond this limit
 *     is counted at 100% towards the norm.
 * 3.  **Prioritization:** To maximize the benefit for the farmer, fertilizers with a 25%
 *     contribution factor (e.g., compost) are prioritized for the discount over those
 *     with a 75% contribution factor (e.g., strorijke vaste mest).
 *     This has been acknowledged by RVO to be possible in personal communication with Sven.
 *
 * @param {NL2025NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total norm filling and a breakdown per application.
 */
export function calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm(
    input: NL2025NormsFillingInput,
): NormFilling {
    const {
        applications,
        fertilizers,
        has_organic_certification,
        fosfaatgebruiksnorm,
    } = input

    // Create maps for efficient lookups of fertilizers and RVO types.
    // This avoids iterating over the arrays repeatedly in a loop.
    const fertilizersMap = new Map(
        fertilizers.map((fertilizer) => [
            fertilizer.p_id_catalogue,
            fertilizer,
        ]),
    )

    // Determines if at least 20 kg P2O5 / ha is applied with organic-rich fertilizers
    const condition1 =
        determineCondition1StimuleringOrganischeStofrijkeMeststoffen(
            applications,
            fertilizersMap,
            has_organic_certification,
        )

    let totalFilling = new Decimal(0)
    const normLimit = new Decimal(fosfaatgebruiksnorm)
    let remainingDiscountablePhosphate = normLimit // This tracks the remaining P that can be discounted

    // Separate applications into standard and organic-rich
    const standardApplications: {
        application: FertilizerApplication
        p_p_rt: Decimal
        p_app_amount: Decimal
    }[] = []
    const organicRichApplications: {
        application: FertilizerApplication
        p_p_rt: Decimal
        p_app_amount: Decimal
        p_type_rvo: string
        discountFactor: Decimal
        originalIndex: number
    }[] = []

    applications.forEach((application, index) => {
        const p_app_amount = new Decimal(application.p_app_amount ?? 0)
        const fertilizer = fertilizersMap.get(application.p_id_catalogue)
        if (!fertilizer) {
            throw new Error(
                `Fertilizer ${application.p_id_catalogue} not found for application ${application.p_app_id}`,
            )
        }
        const p_p_rt = new Decimal(
            fertilizer.p_p_rt ??
                table11Mestcodes.find(
                    (t) => t.p_type_rvo === fertilizer.p_type_rvo,
                )?.p_p_rt ??
                0,
        )
        const p_type_rvo = fertilizer.p_type_rvo ?? ""

        if (
            rvoMestcodesOrganicRich25Percent.includes(p_type_rvo) ||
            rvoMestcodesOrganicRich75Percent.includes(p_type_rvo) ||
            (rvoMestcodesOrganicRich75PercentOrganic.includes(p_type_rvo) &&
                has_organic_certification)
        ) {
            let discountFactor: Decimal
            if (rvoMestcodesOrganicRich25Percent.includes(p_type_rvo)) {
                discountFactor = new Decimal(0.25)
            } else {
                discountFactor = new Decimal(0.75)
            }
            organicRichApplications.push({
                application,
                p_p_rt,
                p_app_amount,
                p_type_rvo,
                discountFactor,
                originalIndex: index,
            })
        } else {
            standardApplications.push({ application, p_p_rt, p_app_amount })
        }
    })

    // Sort organic-rich applications to prioritize 25% discount over 75% discount
    organicRichApplications.sort((a, b) =>
        a.discountFactor.cmp(b.discountFactor),
    )

    // Initialize applicationsFilling with placeholders to maintain original order
    const orderedApplicationsFilling: {
        p_app_id: string
        normFilling: number
        normFillingDetails?: string
    }[] = new Array(applications.length)

    // Process standard applications first
    for (const { application, p_p_rt, p_app_amount } of standardApplications) {
        const normFilling = p_app_amount.times(p_p_rt).dividedBy(1000)
        totalFilling = totalFilling.plus(normFilling)
        orderedApplicationsFilling[
            applications.findIndex(
                (app) => app.p_app_id === application.p_app_id,
            )
        ] = {
            p_app_id: application.p_app_id,
            normFilling: normFilling.toNumber(),
        }
    }

    // Process organic-rich applications with iterative discounting
    if (condition1) {
        for (const {
            application,
            p_p_rt,
            p_app_amount,
            discountFactor,
            originalIndex,
        } of organicRichApplications) {
            const actualPhosphateApplied = p_app_amount
                .times(p_p_rt)
                .dividedBy(1000)
            let currentApplicationFilling = new Decimal(0)
            let normFillingDetails: string

            // Calculate how much of this application can be discounted
            const phosphateToDiscount = Decimal.min(
                actualPhosphateApplied,
                remainingDiscountablePhosphate,
            )

            if (phosphateToDiscount.gt(0)) {
                currentApplicationFilling = currentApplicationFilling.plus(
                    phosphateToDiscount.times(discountFactor),
                )
                remainingDiscountablePhosphate =
                    remainingDiscountablePhosphate.minus(phosphateToDiscount)
                normFillingDetails = `OS-rijke meststof (${discountFactor.times(
                    100,
                )}% korting) draagt ${phosphateToDiscount
                    .times(discountFactor)
                    .toFixed(2)}kg bij aan de norm.`
            } else {
                normFillingDetails =
                    "OS-rijke meststof, geen korting toegepast."
            }

            // Add any remaining actual phosphate (beyond the discountable limit) at 100%
            const phosphateBeyondDiscount =
                actualPhosphateApplied.minus(phosphateToDiscount)
            if (phosphateBeyondDiscount.gt(0)) {
                currentApplicationFilling = currentApplicationFilling.plus(
                    phosphateBeyondDiscount,
                )
                normFillingDetails += ` Plus ${phosphateBeyondDiscount.toFixed(
                    2,
                )}kg (100% geteld) boven de kortingslimiet.`
            }

            totalFilling = totalFilling.plus(currentApplicationFilling)
            orderedApplicationsFilling[originalIndex] = {
                p_app_id: application.p_app_id,
                normFilling: currentApplicationFilling.toNumber(),
                normFillingDetails: normFillingDetails,
            }
        }
    } else {
        // If condition1 is not met, organic-rich fertilizers are counted at 100%
        for (const {
            application,
            p_p_rt,
            p_app_amount,
            originalIndex,
        } of organicRichApplications) {
            const normFilling = p_app_amount.times(p_p_rt).dividedBy(1000)
            totalFilling = totalFilling.plus(normFilling)
            orderedApplicationsFilling[originalIndex] = {
                p_app_id: application.p_app_id,
                normFilling: normFilling.toNumber(),
                normFillingDetails:
                    "OS-rijke meststof, minimumdrempel niet gehaald, 100% geteld.",
            }
        }
    }

    // Return the total norm filling and the breakdown per application.
    return {
        normFilling: totalFilling.toNumber(),
        applicationFilling: orderedApplicationsFilling,
    }
}

/**
 * Determines if at least 20 kg P2O5 / ha is applied with organic-rich fertilizers.
 * This is Condition 1 for the "Stimuleren organische stofrijke meststoffen" regulation.
 *
 * @param {FertilizerApplication[]} applications - An array of fertilizer applications.
 * @param {Map<string, Fertilizer>} fertilizersMap - A map of fertilizers for efficient lookup.
 * @param {boolean} has_organic_certification - Indicates if the farm has organic certification.
 * @returns {boolean} True if the 20 kg/ha threshold is met, false otherwise.
 */
function determineCondition1StimuleringOrganischeStofrijkeMeststoffen(
    applications: FertilizerApplication[],
    fertilizersMap: Map<string, Fertilizer>,
    has_organic_certification: boolean,
): boolean {
    // Set the RVO mestcodes for organic-rich fertilizers
    const rvoMestcodesOrganicRich = [
        ...rvoMestcodesOrganicRich25Percent,
        ...rvoMestcodesOrganicRich75Percent,
    ]
    if (has_organic_certification) {
        rvoMestcodesOrganicRich.push(...rvoMestcodesOrganicRich75PercentOrganic)
    }

    // Sum the phosphate dose of organic-rich fertilizers
    const totalPhosphateDoseOrganicDose = applications.reduce(
        (acc, application) => {
            const fertilizer = fertilizersMap.get(application.p_id_catalogue)
            if (!fertilizer) {
                return acc
            }

            const p_p_rt = new Decimal(
                fertilizer.p_p_rt ??
                    table11Mestcodes.find(
                        (t) => t.p_type_rvo === fertilizer.p_type_rvo,
                    )?.p_p_rt ??
                    0,
            )

            if (p_p_rt.isZero()) {
                return acc
            }

            const p_app_amount = new Decimal(application.p_app_amount ?? 0)
            const actualPhosphate = p_app_amount.times(p_p_rt).dividedBy(1000)

            if (rvoMestcodesOrganicRich.includes(fertilizer.p_type_rvo ?? "")) {
                return acc.plus(actualPhosphate)
            }
            return acc
        },
        new Decimal(0),
    )
    return totalPhosphateDoseOrganicDose.gte(20)
}

/**
 * Memoized version of {@link calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm}.
 *
 * This function is wrapped with `withCalculationCache` to optimize performance by caching
 * results based on the input and the current calculator version.
 *
 * @param {NL2025NormsFillingInput} input - The standardized input object containing all necessary data.
 * @returns {NormFilling} An object containing the total norm filling and a breakdown per application.
 */
export const getNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm =
    withCalculationCache(
        calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm,
        "calculateNL2025FertilizerApplicationFillingForFosfaatGebruiksNorm",
        pkg.calculatorVersion,
    )
