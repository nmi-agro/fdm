import { Decimal } from "decimal.js"
import type { GebruiksnormResult, NormFilling } from "./nl/types"

/**
 * Represents the input structure for the `aggregateNormsToFarmLevel` function.
 * It is an array of objects, where each object contains information for a single field.
 */
export type InputAggregateNormsToFarmLevel = {
  /**
   * The unique identifier of the field.
   */
  b_id: string
  /**
   * The area of the field in hectares.
   */
  b_area: number
  /**
   * The calculated norm values for manure, nitrogen, and phosphate for this field.
   */
  norms: {
    manure: GebruiksnormResult
    nitrogen: GebruiksnormResult
    phosphate: GebruiksnormResult
    /**
     * The Renure norm value for this field, kg N/ha.
     * Only present from 2026 onwards; omitted for years without a Renure norm.
     */
    renure?: GebruiksnormResult
  }
}[]

/**
 * Represents the aggregated output of the `aggregateNormsToFarmLevel` function.
 * The results are expressed as total amounts for the farm, not per hectare.
 */
export type AggregatedNormsToFarmLevel = {
  /**
   * Total manure norm in kg N for the entire farm.
   */
  manure: number // kg N
  /**
   * Total nitrogen norm in kg N for the entire farm.
   */
  nitrogen: number // kg N
  /**
   * Total phosphate norm in kg P2O5 for the entire farm.
   */
  phosphate: number // kg P2O5
  /**
   * Total Renure norm in kg N for the entire farm.
   *  Only present from 2026 onwards; omitted for years without a Renure norm.
   */
  renure?: number // kg N
}

/**
 * Aggregates the norm values from individual fields to the farm level.
 * This function takes the output per field of the norm calculation,
 * multiplies each norm by the field's area, and sums these values
 * across all fields to provide total norms for the farm.
 *
 * The result are three numbers (manure, nitrogen, phosphate) expressed as totals, not per hectare.
 *
 * @param input An array of field data, each containing field ID, area, and calculated norms.
 * @returns An object containing the total aggregated norms for manure, nitrogen, and phosphate for the farm.
 *
 * @example
 * const fieldData = [
 *   {
 *     b_id: "field1",
 *     b_area: 10, // hectares
 *     norms: {
 *       manure: { normValue: 100, normSource: "Source A" }, // kg N/ha
 *       nitrogen: { normValue: 150, normSource: "Source B" }, // kg N/ha
 *       phosphate: { normValue: 50, normSource: "Source C" }, // kg P2O5/ha
 *     },
 *   },
 *   {
 *     b_id: "field2",
 *     b_area: 5, // hectares
 *     norms: {
 *       manure: { normValue: 90, normSource: "Source A" }, // kg N/ha
 *       nitrogen: { normValue: 140, normSource: "Source B" }, // kg N/ha
 *       phosphate: { normValue: 45, normSource: "Source C" }, // kg P2O5/ha
 *     },
 *   },
 * ];
 *
 * const aggregatedNorms = aggregateNormsToFarmLevel(fieldData);
 * // aggregatedNorms will be:
 * // {
 * //   manure: (100 * 10) + (90 * 5) = 1000 + 450 = 1450,
 * //   nitrogen: (150 * 10) + (140 * 5) = 1500 + 700 = 2200,
 * //   phosphate: (50 * 10) + (45 * 5) = 500 + 225 = 725,
 * // }
 */
export function aggregateNormsToFarmLevel(
  input: InputAggregateNormsToFarmLevel,
): AggregatedNormsToFarmLevel {
  let totalManure = new Decimal(0)
  let totalNitrogen = new Decimal(0)
  let totalPhosphate = new Decimal(0)
  let totalRenure: Decimal | undefined = undefined

  for (const field of input) {
    const area = new Decimal(field.b_area)
    totalManure = totalManure.plus(new Decimal(field.norms.manure.normValue).times(area))
    totalNitrogen = totalNitrogen.plus(new Decimal(field.norms.nitrogen.normValue).times(area))
    totalPhosphate = totalPhosphate.plus(new Decimal(field.norms.phosphate.normValue).times(area))
    if (field.norms.renure) {
      totalRenure = (totalRenure ?? new Decimal(0)).plus(
        new Decimal(field.norms.renure.normValue).times(area),
      )
    }
  }

  return {
    manure: totalManure.toDecimalPlaces(0).toNumber(),
    nitrogen: totalNitrogen.toDecimalPlaces(0).toNumber(),
    phosphate: totalPhosphate.toDecimalPlaces(0).toNumber(),
    renure: totalRenure ? totalRenure.toDecimalPlaces(0).toNumber() : undefined,
  }
}

/**
 * Represents the input structure for the `aggregateNormFillingsToFarmLevel` function.
 * It is an array of objects, where each object contains information for a single field.
 */
export type InputAggregateNormFillingsToFarmLevel = {
  /**
   * The unique identifier of the field.
   */
  b_id: string
  /**
   * The area of the field in hectares.
   */
  b_area: number
  /**
   * The calculated norm fillings for manure, nitrogen, and phosphate for this field.
   */
  normsFilling: {
    manure: NormFilling
    nitrogen: NormFilling
    phosphate: NormFilling
    /**
     * The Renure norm filling for this field.
     * Only present from 2026 onwards; omitted for years without a Renure norm.
     */
    renure?: NormFilling
  }
}[]

/**
 * Represents the aggregated output of the `aggregateNormFillingsToFarmLevel` function.
 * The results are expressed as total amounts for the farm, not per hectare.
 */
export type AggregatedNormFillingsToFarmLevel = {
  /**
   * Total manure norm filling in kg N for the entire farm.
   */
  manure: number
  /**
   * Total nitrogen norm filling in kg N for the entire farm.
   */
  nitrogen: number
  /**
   * Total phosphate norm filling in kg P2O5 for the entire farm.
   */
  phosphate: number
  /**
   * Total Renure norm filling in kg N for the entire farm. Only meaningful
   * from 2026 onwards; 0 when no field supplied a `renure` filling.
   */
  renure: number
}

/**
 * Aggregates the norm filling values from individual fields to the farm level.
 * This function takes the output per field of the norm filling calculation,
 * multiplies each norm filling by the field's area, and sums these values
 * across all fields to provide total norm fillings for the farm.
 *
 * The result are three objects (manure, nitrogen, phosphate) each containing
 * the total normFilling and combined applicationFillings, expressed as totals, not per hectare.
 *
 * @param input An array of field data, each containing field ID, area, and calculated norm fillings.
 * @returns An object containing the total aggregated norm fillings for manure, nitrogen, and phosphate for the farm.
 */
export function aggregateNormFillingsToFarmLevel(
  input: InputAggregateNormFillingsToFarmLevel,
): AggregatedNormFillingsToFarmLevel {
  let totalManureFilling = new Decimal(0)
  let totalNitrogenFilling = new Decimal(0)
  let totalPhosphateFilling = new Decimal(0)
  let totalRenureFilling = new Decimal(0)

  for (const field of input) {
    const area = new Decimal(field.b_area)

    // Aggregate manure filling
    totalManureFilling = totalManureFilling.plus(
      new Decimal(field.normsFilling.manure.normFilling).times(area),
    )

    // Aggregate nitrogen filling
    totalNitrogenFilling = totalNitrogenFilling.plus(
      new Decimal(field.normsFilling.nitrogen.normFilling).times(area),
    )

    // Aggregate phosphate filling
    totalPhosphateFilling = totalPhosphateFilling.plus(
      new Decimal(field.normsFilling.phosphate.normFilling).times(area),
    )

    // Aggregate Renure filling (only present from 2026 onwards)
    if (field.normsFilling.renure) {
      totalRenureFilling = totalRenureFilling.plus(
        new Decimal(field.normsFilling.renure.normFilling).times(area),
      )
    }
  }

  return {
    manure: totalManureFilling.toDecimalPlaces(0).toNumber(),
    nitrogen: totalNitrogenFilling.toDecimalPlaces(0).toNumber(),
    phosphate: totalPhosphateFilling.toDecimalPlaces(0).toNumber(),
    renure: totalRenureFilling.toDecimalPlaces(0).toNumber(),
  }
}
