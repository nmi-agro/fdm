import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FieldInput,
  NitrogenEmissionNitrousOxideResidues,
} from "../../types"
import { calculateNitrogenInCropResiduesLeft } from "../crop-residues"
import { EF_N2O_CROP_RESIDUES } from "./constants"
import { toEmission } from "./conversion"

/**
 * Calculates the direct nitrous oxide (N₂O) emission from the nitrogen in the above-ground crop
 * residues left on the field.
 *
 * The emission of a cultivation is the nitrogen in its crop residues left on the field times the
 * emission factor for crop residues (0.01). Residues that are removed, or of which this is unknown,
 * give no emission.
 *
 * @param cultivations - The cultivations of the field.
 * @param harvests - The harvests of the field, used for the yield of the cultivations.
 * @param cultivationDetailsMap - A map of cultivation details, with the cultivation catalogue identifier as key.
 * @returns The N₂O emission in total and per cultivation (kg N / ha, as N₂O-N, negative).
 * @throws {Error} If a cultivation has no cultivation details.
 *
 * @example
 * ```ts
 * const residues = calculateNitrogenEmissionViaNitrousOxideByResidues(cultivations, harvests, cultivationDetailsMap)
 * // residues.total: Decimal(-0.35) for 35 kg N in the crop residues
 * ```
 */
export function calculateNitrogenEmissionViaNitrousOxideByResidues(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
): NitrogenEmissionNitrousOxideResidues {
  const residues: NitrogenEmissionNitrousOxideResidues = {
    total: new Decimal(0),
    cultivations: [],
  }

  for (const cultivation of cultivations) {
    const cultivationDetail = cultivationDetailsMap.get(cultivation.b_lu_catalogue)
    if (!cultivationDetail) {
      throw new Error(
        `Cultivation ${cultivation.b_lu} has no corresponding cultivation in cultivationDetails`,
      )
    }
    const residueNitrogen = calculateNitrogenInCropResiduesLeft(
      cultivation,
      harvests,
      cultivationDetail,
    )
    const value = toEmission(residueNitrogen.times(EF_N2O_CROP_RESIDUES))
    residues.total = residues.total.add(value)
    residues.cultivations.push({ id: cultivation.b_lu, value })
  }

  return residues
}
