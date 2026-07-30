import Decimal from "decimal.js"
import type { CultivationDetail, FieldInput, OrganicMatterSupplyCultivations } from "../types"

/**
 * Calculates the supply of effective organic matter (EOM) from cultivations like main crops and green manures.
 *
 * This function iterates through a list of cultivations for a field and sums the EOM
 * contributed by each. The EOM value for each cultivation type is retrieved from the
 * cultivation catalogue (`b_lu_eom`), which represents the annual EOM supply in kg/ha/year.
 *
 * The current implementation assumes a direct annual contribution and does not adjust for the
 * exact duration of the cultivation within the year.
 *
 * @param cultivations - An array of cultivation records for the field.
 * @param cultivationDetailsMap - A map containing detailed information for each cultivation type, including its `b_lu_eom` value.
 * @returns An object containing the total EOM supplied by all cultivations and a detailed list of contributions per cultivation.
 */
export function calculateOrganicMatterSupplyByCultivations(
  cultivations: FieldInput["cultivations"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
): OrganicMatterSupplyCultivations {
  let total = new Decimal(0)
  const cultivationsSupply: { id: string; value: Decimal }[] = []

  // Loop through each cultivation that occurred on the field.
  for (const cult of cultivations) {
    // Get the detailed properties for this cultivation type from the map.
    const cultivationDetail = cultivationDetailsMap.get(cult.b_lu_catalogue)

    // Check if the cultivation has a defined EOM supply value.
    if (cultivationDetail?.b_lu_eom) {
      // `b_lu_eom` is the annual EOM supply in kg/ha/year for this cultivation type.
      const omSupply = new Decimal(cultivationDetail.b_lu_eom)

      // Add the supply from this cultivation to the total.
      total = total.plus(omSupply)

      // Record the contribution for this specific cultivation instance.
      cultivationsSupply.push({ id: cult.b_lu, value: omSupply })
    }
  }

  return {
    total,
    cultivations: cultivationsSupply,
  }
}
