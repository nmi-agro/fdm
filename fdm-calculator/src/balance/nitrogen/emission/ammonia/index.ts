import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  NitrogenEmissionAmmonia,
} from "../../types"
import { calculateNitrogenEmissionViaAmmoniaByFertilizers } from "./fertilizers"
import { calculateNitrogenEmissionViaAmmoniaByResidues } from "./residues"

/**
 * Calculates the total nitrogen volatilization from a field, through ammonia emissions from fertilizer appplications and crop residues.
 *
 * This function orchestrates the calculation of ammonia emission by calling separate functions for fertilizer applications and
 * residue volatilization, then aggregates the results.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param cultivationDetailsMap - A map containing details for each cultivation, including its nitrogen content and residue management practices.
 * @returns The NitrogenEmmissionAmmonia object containing the total amount of Nitrogen volatilized and the individual ammonia values.
 */
export function calculateNitrogenEmissionViaAmmonia(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
): NitrogenEmissionAmmonia {
  /** Calculate the total amount of Nitrogen volatilized as Ammonia by fertilizer application */
  const fertilizers = calculateNitrogenEmissionViaAmmoniaByFertilizers(
    cultivations,
    fertilizerApplications,
    cultivationDetailsMap,
    fertilizerDetailsMap,
  )

  /** Calculate the total amount of Nitrogen volatilized as Ammonia by crop residues */
  const residues = calculateNitrogenEmissionViaAmmoniaByResidues(
    cultivations,
    harvests,
    cultivationDetailsMap,
  )

  const ammonia = {
    total: fertilizers.total.add(residues.total), // Ammonia total should include fertilizers total and residues total
    fertilizers: fertilizers,
    residues: residues,
    grazing: undefined, // Grazing volatilization not yet implemented
  }

  return ammonia
}
