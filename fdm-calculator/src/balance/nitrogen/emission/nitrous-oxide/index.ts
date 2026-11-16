import Decimal from "decimal.js"
import type {
  CultivationDetail,
  FertilizerDetail,
  FieldInput,
  NitrogenEmissionNitrousOxide,
  SoilAnalysisPicked,
} from "../../types"
import { convertNitrousOxideToCo2Equivalent } from "./conversion"
import {
  calculateNitrogenEmissionViaNitrousOxideByFertilizers,
  createEmptyNitrousOxideEmissionFertilizers,
} from "./fertilizers"
import { calculateNitrogenEmissionViaNitrousOxideByResidues } from "./residues"
import { calculateNitrogenEmissionViaNitrousOxideBySoil } from "./soil"

/**
 * Calculates the direct nitrous oxide (N₂O) emission of a field according to the Dutch National
 * Emission Model for Agriculture (NEMA), from fertilizer applications, crop residues and organic soils.
 *
 * This function orchestrates the calculation by calling separate functions for fertilizer
 * applications, crop residues and the soil, then aggregates the results. The N₂O emission is part
 * of the nitrogen balance. Following the other nitrogen losses, the N₂O emission is negative
 * (kg N / ha, as N₂O-N). The CO₂-equivalent is positive, as it is a greenhouse gas emission
 * (kg CO₂-eq / ha).
 *
 * @param cultivations - The cultivations of the field.
 * @param harvests - The harvests of the field.
 * @param fertilizerApplications - The fertilizer applications on the field.
 * @param cultivationDetailsMap - A map of cultivation details, with the cultivation catalogue identifier as key.
 * @param fertilizerDetailsMap - A map of fertilizer details, with the fertilizer catalogue identifier as key.
 * @param soilAnalysis - The soil parameters of the field; `b_soiltype_agr` is used.
 * @param timeFrame - The period of the calculation for this field. When the end is before the start,
 * the field has no overlap with the time frame and gets no emission from organic soils.
 * @returns The N₂O emission by source, the total N₂O emission and the CO₂-equivalent.
 * @throws {Error} If a fertilizer application has no fertilizer details, if a manure application has
 * no application method, or if a cultivation has no cultivation details.
 *
 * @example
 * ```ts
 * const nitrousOxide = calculateNitrogenEmissionViaNitrousOxide(
 *   cultivations,
 *   harvests,
 *   fertilizerApplications,
 *   cultivationDetailsMap,
 *   fertilizerDetailsMap,
 *   soilAnalysis,
 *   timeFrame,
 * )
 * // nitrousOxide.total: Decimal(-2.649), nitrousOxide.co2eq: Decimal(1103.1)
 * ```
 */
export function calculateNitrogenEmissionViaNitrousOxide(
  cultivations: FieldInput["cultivations"],
  harvests: FieldInput["harvests"],
  fertilizerApplications: FieldInput["fertilizerApplications"],
  cultivationDetailsMap: Map<string, CultivationDetail>,
  fertilizerDetailsMap: Map<string, FertilizerDetail>,
  soilAnalysis: Pick<SoilAnalysisPicked, "b_soiltype_agr">,
  timeFrame: { start: Date; end: Date },
): NitrogenEmissionNitrousOxide {
  /** Calculate the N₂O emission from fertilizer applications */
  const fertilizers = calculateNitrogenEmissionViaNitrousOxideByFertilizers(
    cultivations,
    fertilizerApplications,
    cultivationDetailsMap,
    fertilizerDetailsMap,
    soilAnalysis,
  )

  /** Calculate the N₂O emission from crop residues left on the field */
  const residues = calculateNitrogenEmissionViaNitrousOxideByResidues(
    cultivations,
    harvests,
    cultivationDetailsMap,
  )

  /** Calculate the N₂O emission from the mineralisation of organic soils */
  const soil = calculateNitrogenEmissionViaNitrousOxideBySoil(soilAnalysis, timeFrame)

  const total = fertilizers.total.add(residues.total).add(soil.total)

  return {
    total: total,
    fertilizers: fertilizers,
    residues: residues,
    soil: soil,
    co2eq: convertNitrousOxideToCo2Equivalent(total),
  }
}

/**
 * Creates an N₂O emission with all values set to zero, e.g. for buffer strips.
 *
 * @returns An N₂O emission with all values set to zero.
 */
export function createEmptyNitrousOxideEmission(): NitrogenEmissionNitrousOxide {
  return {
    total: new Decimal(0),
    fertilizers: createEmptyNitrousOxideEmissionFertilizers(),
    residues: { total: new Decimal(0), cultivations: [] },
    soil: { total: new Decimal(0) },
    co2eq: new Decimal(0),
  }
}
