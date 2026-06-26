import { Decimal } from "decimal.js"
import type { FertilizerDetail, FieldInput, NitrogenSupplyFertilizers } from "../types"

/**
 * Calculates the total nitrogen supply from all fertilizer sources (mineral, manure, compost and other fertilizers).
 *
 * This function aggregates the nitrogen contributions from mineral fertilizers, manure, compost and other fertilizers
 * by iterating through the applications once and directing each to the appropriate calculation.
 * @param fertilizerApplications - An array of fertilizer applications, each containing the application amount and a reference to the fertilizer details.
 * @param fertilizerDetailsMap - A map containing details for each fertilizer, including its type and nitrogen content.
 * @returns An object containing the total nitrogen supplied by all fertilizers, as well as a breakdown by fertilizer type (mineral, manure, compost, other).
 */
export function calculateNitrogenSupplyByFertilizers(
  fertilizerApplications: FieldInput["fertilizerApplications"],
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
): NitrogenSupplyFertilizers {
  const initialSupply: NitrogenSupplyFertilizers = {
    total: new Decimal(0),
    mineral: { total: new Decimal(0), applications: [] },
    manure: { total: new Decimal(0), applications: [] },
    compost: { total: new Decimal(0), applications: [] },
    other: { total: new Decimal(0), applications: [] },
  }

  const aggregatedSupply = fertilizerApplications.reduce((acc, application) => {
    const fertilizerDetail = fertilizerDetailsMap.get(application.p_id_catalogue)

    if (!fertilizerDetail) {
      throw new Error(
        `Fertilizer application ${application.p_app_id} has no fertilizerDetails for fertilizer ${application.p_id_catalogue}`,
      )
    }

    const p_n_rt = new Decimal(fertilizerDetail.p_n_rt ?? 0)
    const p_app_amount = new Decimal(application.p_app_amount ?? 0)

    // p_n_rt is g N per kg fertilizer; p_app_amount is kg fertilizer / ha
    // applicationValue is kg N / ha
    const applicationValue = p_app_amount.times(p_n_rt).dividedBy(1000)
    const newApplicationEntry = {
      id: application.p_app_id,
      value: applicationValue,
    }

    switch (fertilizerDetail.p_type) {
      case "mineral":
        acc.mineral.total = acc.mineral.total.add(applicationValue)
        acc.mineral.applications.push(newApplicationEntry)
        break
      case "manure":
        acc.manure.total = acc.manure.total.add(applicationValue)
        acc.manure.applications.push(newApplicationEntry)
        break
      case "compost":
        acc.compost.total = acc.compost.total.add(applicationValue)
        acc.compost.applications.push(newApplicationEntry)
        break
      default:
        // This covers "other" types
        acc.other.total = acc.other.total.add(applicationValue)
        acc.other.applications.push(newApplicationEntry)
        break
    }

    return acc
  }, initialSupply)

  // Calculate the total amount of Nitrogen supplied by all fertilizers
  aggregatedSupply.total = aggregatedSupply.mineral.total
    .add(aggregatedSupply.manure.total)
    .add(aggregatedSupply.compost.total)
    .add(aggregatedSupply.other.total)

  return aggregatedSupply
}
