import type { HarvestableAnalysis } from "@nmi-agro/fdm-core"
import Decimal from "decimal.js"
import type {
    CultivationDetail,
    FieldInput,
    NitrogenEmissionAmmoniaResidues,
} from "../../types"

/**
 * Calculates the amount of Nitrogen volatilized via ammonia emissions from crop residues.
 *
 * This function determines the nitrogen volatilization from crop residues based on the cultivations performed, harvest yields,
 * and cultivation details, including the nitrogen content of the crop residues. It calculates an emission factor
 * based on the nitrogen content and then estimates the total nitrogen volatilization.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param cultivationDetailsMap - The map of cultivation details.
 */
export function calculateNitrogenEmissionViaAmmoniaByResidues(
    cultivations: FieldInput["cultivations"],
    harvests: FieldInput["harvests"],
    cultivationDetailsMap: Map<string, CultivationDetail>,
): NitrogenEmissionAmmoniaResidues {
    if (cultivations.length === 0) {
        return {
            total: new Decimal(0),
            cultivations: [],
        }
    }
    const volatilizationResidue = cultivations.map((cultivation) => {
        // Get details of cultivation using the Map
        const cultivationDetail = cultivationDetailsMap.get(
            cultivation.b_lu_catalogue,
        )

        if (!cultivationDetail) {
            throw new Error(
                `Cultivation ${cultivation.b_lu} has no corresponding cultivation in cultivationDetails`,
            )
        }

        // If no crop residues are left or if this is not know return 0 for the amount of Nitrogen volatilized by crop residues
        if (!cultivation.m_cropresidue) {
            return {
                id: cultivation.b_lu,
                value: new Decimal(0),
            }
        }

        // Get the (total) yield for this crop and number of harvests
        let totalYield = new Decimal(0)
        let harvestCount = 0
        let b_lu_yield = new Decimal(0)
        for (const harvest of harvests.filter(
            (h) => h.b_lu === cultivation.b_lu,
        )) {
            let yieldForThisHarvest: Decimal | null = null
            if (
                harvest.harvestable?.harvestable_analyses &&
                harvest.harvestable.harvestable_analyses.length > 0
            ) {
                // Prioritize the specific yield if available
                const analysisWithYield =
                    harvest.harvestable.harvestable_analyses.find(
                        (analysis: HarvestableAnalysis) =>
                            analysis.b_lu_yield !== undefined,
                    )
                if (analysisWithYield) {
                    yieldForThisHarvest = new Decimal(
                        analysisWithYield.b_lu_yield ?? 0,
                    )
                }
            }

            // Fallback to default yield from cultivation_catalogue
            if (yieldForThisHarvest === null) {
                yieldForThisHarvest = new Decimal(
                    cultivationDetail.b_lu_yield ?? 0,
                )
            }

            if (yieldForThisHarvest !== null) {
                totalYield = totalYield.add(yieldForThisHarvest)
                harvestCount++
            }
        }

        // Get the average yield for the cultivation
        if (harvestCount === 0) {
            // Return default yield from cultivation catalogue
            b_lu_yield = new Decimal(cultivationDetail.b_lu_yield ?? 0)
        } else {
            b_lu_yield = totalYield.dividedBy(harvestCount)
        }

        // Get the harvest index for crop residues
        const b_lu_hi = new Decimal(cultivationDetail.b_lu_hi ?? 0)
        const b_lu_hi_res = new Decimal(1).minus(b_lu_hi)

        // If cultivation has no residues possible return 0
        if (b_lu_hi.isZero()) {
            return {
                id: cultivation.b_lu,
                value: new Decimal(0),
            }
        }

        // Get the Nitrogen content of the crop residues
        const b_lu_n_residue = new Decimal(
            cultivationDetail.b_lu_n_residue ?? 0,
        )

        // Calculate the Emission Factor
        let emissionFactor = new Decimal(0.41)
            .times(b_lu_n_residue)
            .minus(5.42)
            .dividedBy(100)
        if (emissionFactor.lt(0)) {
            emissionFactor = new Decimal(0)
        } else if (emissionFactor.gt(1)) {
            emissionFactor = new Decimal(1)
        }

        // Calculate the amount of Nitrogen volatilized by crop residues of this cultivation
        const removal = b_lu_yield
            .dividedBy(b_lu_hi)
            .times(b_lu_hi_res)
            .times(b_lu_n_residue)
            .times(emissionFactor)
            .dividedBy(new Decimal(1000)) // Convert from g N / ha to kg N / ha
            .times(-1) // Return negative value

        return {
            id: cultivation.b_lu,
            value: removal,
        }
    })

    // Aggregate the total amount of Nitrogen volatilized by crop residues
    const totalValue = volatilizationResidue.reduce((acc, residue) => {
        return acc.add(residue.value)
    }, new Decimal(0))

    return {
        total: totalValue,
        cultivations: volatilizationResidue,
    }
}
