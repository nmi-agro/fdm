import Decimal from "decimal.js"
import type {
    CultivationDetail,
    FieldInput,
    OrganicMatterBalanceInput,
    OrganicMatterSupplyResidues,
} from "../types"

/**
 * Calculates the supply of effective organic matter (EOM) from crop residues that are left on the field.
 *
 * This function evaluates each cultivation to determine if its residues contribute to the soil's organic matter.
 * The contribution is only counted if two conditions are met:
 * 1. The `m_cropresidue` flag for the cultivation is true, indicating that residues were incorporated into the soil.
 * 2. The cultivation's end date (`b_lu_end`) falls within the specified calculation timeframe.
 *
 * The EOM value for residues is sourced from the cultivation catalogue (`b_lu_eom_residue`).
 *
 * @param cultivations - An array of cultivation records for the field.
 * @param cultivationDetailsMap - A map containing detailed information for each cultivation type, including its `b_lu_eom_residue` value.
 * @param timeFrame - The start and end dates for the calculation period.
 * @returns An object containing the total EOM supplied by all qualifying residues and a detailed list of contributions per cultivation.
 */
export function calculateOrganicMatterSupplyByResidues(
    cultivations: FieldInput["cultivations"],
    cultivationDetailsMap: Map<string, CultivationDetail>,
    timeFrame: OrganicMatterBalanceInput["timeFrame"],
): OrganicMatterSupplyResidues {
    let total = new Decimal(0)
    const cultivationsSupply: { id: string; value: Decimal }[] = []

    // Loop through each cultivation to check for residue contribution.
    for (const cult of cultivations) {
        // Get the detailed properties for this cultivation type.
        const cultivationDetail = cultivationDetailsMap.get(cult.b_lu_catalogue)

        // Proceed only if the cultivation type has a defined EOM value for residues
        // and the 'm_cropresidue' flag is explicitly set to true.
        if (cultivationDetail?.b_lu_eom_residue != null && cult.m_cropresidue) {
            // Ensure the cultivation ended within the calculation timeframe.
            const terminationDate = cult.b_lu_end
                ? new Date(cult.b_lu_end)
                : null
            if (
                terminationDate &&
                terminationDate >= timeFrame.start &&
                terminationDate <= timeFrame.end
            ) {
                // `b_lu_eom_residue` is the annual EOM supply from residues in kg/ha/year.
                const omSupply = new Decimal(cultivationDetail.b_lu_eom_residue)

                // Add the supply from this residue to the total.
                total = total.plus(omSupply)

                // Record the contribution for this specific cultivation's residue.
                cultivationsSupply.push({ id: cult.b_lu, value: omSupply })
            }
        }
    }

    return {
        total,
        cultivations: cultivationsSupply,
    }
}
