import Decimal from "decimal.js"
import type { FertilizerDetail, FieldInput, OrganicMatterSupplyFertilizers } from "../types"

/**
 * Calculates the total supply of effective organic matter (EOM) from various fertilizer applications.
 *
 * This function processes a list of fertilizer applications, calculates the EOM supplied by each,
 * and aggregates them into categories: `manure`, `compost`, and `other`. The calculation is
 * based on the amount of fertilizer applied and its specific EOM content (`p_eom`), which is
 * expressed in grams of EOM per kilogram of the product.
 *
 * The function returns a detailed breakdown of EOM supply by fertilizer type, as well as a grand total.
 *
 * @param fertilizerApplications - An array of fertilizer application records for a specific field.
 * @param fertilizerDetailsMap - A map containing detailed information about each fertilizer type, including its `p_eom` and `p_type`.
 * @returns An object detailing the EOM supply from fertilizers, categorized by type.
 * @throws {Error} If a fertilizer application references a fertilizer that is not found in the `fertilizerDetailsMap`.
 */
export function calculateOrganicMatterSupplyByFertilizers(
  fertilizerApplications: FieldInput["fertilizerApplications"],
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
): OrganicMatterSupplyFertilizers {
  // Initialize the accumulator with the structure for categorized supply.
  const initialSupply: OrganicMatterSupplyFertilizers = {
    total: new Decimal(0),
    manure: { total: new Decimal(0), applications: [] },
    compost: { total: new Decimal(0), applications: [] },
    other: { total: new Decimal(0), applications: [] },
  }

  // Use reduce to iterate over all applications and aggregate the supply.
  const aggregatedSupply = fertilizerApplications.reduce(
    (
      acc: OrganicMatterSupplyFertilizers,
      application: FieldInput["fertilizerApplications"][number],
    ) => {
      // Retrieve the details for the applied fertilizer from the map.
      const fertilizerDetail = fertilizerDetailsMap.get(application.p_id_catalogue)

      if (!fertilizerDetail) {
        // This indicates a data integrity issue, as all applications should have corresponding details.
        throw new Error(
          `Fertilizer application ${application.p_app_id} has no fertilizerDetails for fertilizer ${application.p_id_catalogue}`,
        )
      }
      // Skip fertilizers that do not contribute to organic matter (e.g., most mineral fertilizers).
      if (fertilizerDetail.p_eom === undefined || fertilizerDetail.p_eom === null) {
        return acc
      }

      const p_eom = new Decimal(fertilizerDetail.p_eom) // g EOM / kg product
      const p_amount = new Decimal(application.p_app_amount ?? 0) // kg product / ha

      // Calculate the EOM supply for this specific application.
      // (g EOM / kg product) * (kg product / ha) / (1000 g / kg) = kg EOM / ha
      const applicationValue = p_amount.times(p_eom).dividedBy(1000)

      const newApplicationEntry = {
        id: application.p_app_id,
        value: applicationValue,
      }

      // Categorize the supply based on the fertilizer type.
      switch (fertilizerDetail.p_type) {
        case "manure":
          acc.manure.total = acc.manure.total.add(applicationValue)
          acc.manure.applications.push(newApplicationEntry)
          break
        case "compost":
          acc.compost.total = acc.compost.total.add(applicationValue)
          acc.compost.applications.push(newApplicationEntry)
          break
        default:
          // All other types, including 'other' and 'mineral' (if they have EOM), fall here.
          acc.other.total = acc.other.total.add(applicationValue)
          acc.other.applications.push(newApplicationEntry)
          break
      }

      return acc
    },
    initialSupply,
  )

  // Sum the totals from each category to get the grand total EOM supply from fertilizers.
  aggregatedSupply.total = aggregatedSupply.manure.total
    .add(aggregatedSupply.compost.total)
    .add(aggregatedSupply.other.total)

  return aggregatedSupply
}
