import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  NitrogenEmission,
  SoilAnalysisPicked,
} from "../types"
import { calculateNitrogenEmissionViaAmmonia } from "./ammonia"
import { calculateNitrogenEmissionViaNitrousOxide } from "./nitrous-oxide"

/**
 * Calculates the nitrogen emission from a field through ammonia and nitrous oxide (N₂O).
 *
 * This function orchestrates the calculation of the ammonia emission (fertilizer applications and
 * crop residues) and the N₂O emission (fertilizer applications, crop residues and organic soils),
 * then aggregates the results. The nitrate leaching depends on the surplus of the balance, so it is
 * set to zero here and calculated once the surplus is known.
 * @param cultivations - A list of cultivations on the field.
 * @param harvests - A list of harvests from the field.
 * @param fertilizerApplications - A list of fertilizer applications on the field.
 * @param cultivationDetailsMap - A map containing details for each cultivation, including its nitrogen content and residue management practices.
 * @param fertilizerDetailsMap - A map containing details for each fertilizer.
 * @param soilAnalysis - The soil parameters of the field; `b_soiltype_agr` is used for the N₂O emission.
 * @param timeFrame - The period of the calculation for this field, used for the N₂O emission of organic soils.
 * @returns The NitrogenEmission object with the ammonia and N₂O emission, and their total.
 */
export function calculateNitrogenEmission(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
  soilAnalysis: Pick<SoilAnalysisPicked, "b_soiltype_agr">,
  timeFrame: { start: Date; end: Date },
): NitrogenEmission {
  /** Calculate the total amount of Nitrogen volatilized as Ammonia */
  const ammonia = calculateNitrogenEmissionViaAmmonia(
    cultivations,
    harvests,
    fertilizerApplications,
    cultivationDetailsMap,
    fertilizerDetailsMap,
  )

  /** Calculate the total amount of Nitrogen emitted as N₂O */
  const nitrous_oxide = calculateNitrogenEmissionViaNitrousOxide(
    cultivations,
    harvests,
    fertilizerApplications,
    cultivationDetailsMap,
    fertilizerDetailsMap,
    soilAnalysis,
    timeFrame,
  )

  const emission = {
    total: ammonia.total.add(nitrous_oxide.total),
    ammonia: ammonia,
    nitrate: {
      total: new Decimal(0), // Nitrate emission is calculated as factor of nitrogen surplus this will be calculated after surplus is known
    },
    nitrous_oxide: nitrous_oxide,
  }

  return emission
}
