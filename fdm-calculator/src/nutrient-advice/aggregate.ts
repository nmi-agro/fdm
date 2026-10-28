import Decimal from "decimal.js"

/**
 * The dose and advice of a single nutrient on a single field, both in kg (or g) per hectare.
 */
export type NutrientDoseAndAdvice = {
  /** The applied or planned dose, in kg/ha (g/ha for trace elements). */
  dose: number
  /** The advised amount, in kg/ha (g/ha for trace elements). */
  advice: number
}

/**
 * The input for a single field of {@link aggregateNutrientAdviceToFarmLevel}.
 *
 * @typeParam K - The keys that identify the nutrients, for example `"N" | "P" | "K"`.
 */
export type InputAggregateNutrientAdviceToFarmLevel<K extends string> = {
  /** The area of the field in hectares. */
  b_area: number
  /**
   * The dose and advice per nutrient for this field. A nutrient that is missing for this field
   * does not contribute to the aggregate of that nutrient, and neither does the area of the field.
   */
  values: Partial<Record<K, NutrientDoseAndAdvice>>
}

/**
 * The aggregated dose and advice of a single nutrient.
 */
export type AggregatedNutrientAdvice = {
  /**
   * The aggregated dose. In `"per_ha"` mode this is the area-weighted average in kg/ha; in
   * `"total"` mode this is the total in kg.
   */
  dose: number
  /**
   * The aggregated advice. In `"per_ha"` mode this is the area-weighted average in kg/ha; in
   * `"total"` mode this is the total in kg.
   */
  advice: number
  /** The total area, in hectares, of the fields that contributed to this nutrient. */
  b_area: number
}

/**
 * How {@link aggregateNutrientAdviceToFarmLevel} expresses the result:
 * - `"per_ha"`: the area-weighted average per hectare.
 * - `"total"`: the sum over all fields of the value multiplied by the field area.
 */
export type NutrientAdviceAggregationMode = "per_ha" | "total"

/**
 * Aggregates the nutrient dose and advice of several fields to a single value per nutrient.
 *
 * For every nutrient the dose and advice of each field are multiplied by the field area and
 * summed. In `"per_ha"` mode the sums are divided by the total area of the fields that have a
 * value for that nutrient, which gives an area-weighted average in kg/ha. In `"total"` mode
 * the sums are returned as is, in kg.
 *
 * Fields with a missing or non-positive area are ignored. Fields for which the advice could not
 * be calculated should be left out by the caller, or should leave out the affected nutrients,
 * so that they do not pull the average towards zero.
 *
 * This function is pure and has no dependencies on the database, so it can also be used in the
 * browser through `@nmi-agro/fdm-calculator/browser`.
 *
 * @typeParam K - The keys that identify the nutrients.
 * @param fields - The dose and advice per nutrient for each field.
 * @param nutrients - The nutrients to aggregate.
 * @param mode - Whether to return the area-weighted average per hectare or the total.
 * @returns The aggregated dose and advice per nutrient. A nutrient without any contributing
 *   field gets a dose, advice and area of 0.
 *
 * @example
 * ```ts
 * const result = aggregateNutrientAdviceToFarmLevel(
 *   [
 *     { b_area: 2, values: { N: { dose: 100, advice: 150 } } },
 *     { b_area: 1, values: { N: { dose: 40, advice: 60 } } },
 *   ],
 *   ["N"],
 *   "per_ha",
 * )
 * // result.N => { dose: 80, advice: 120, b_area: 3 }
 * ```
 */
export function aggregateNutrientAdviceToFarmLevel<K extends string>(
  fields: InputAggregateNutrientAdviceToFarmLevel<K>[],
  nutrients: readonly K[],
  mode: NutrientAdviceAggregationMode,
): Record<K, AggregatedNutrientAdvice> {
  const result = {} as Record<K, AggregatedNutrientAdvice>

  for (const nutrient of nutrients) {
    let doseSum = new Decimal(0)
    let adviceSum = new Decimal(0)
    let areaSum = new Decimal(0)

    for (const field of fields) {
      const value = field.values[nutrient]
      if (!value || !Number.isFinite(field.b_area) || field.b_area <= 0) continue
      const area = new Decimal(field.b_area)
      doseSum = doseSum.add(new Decimal(value.dose || 0).times(area))
      adviceSum = adviceSum.add(new Decimal(value.advice || 0).times(area))
      areaSum = areaSum.add(area)
    }

    if (mode === "per_ha") {
      result[nutrient] = {
        dose: areaSum.isZero() ? 0 : doseSum.dividedBy(areaSum).toNumber(),
        advice: areaSum.isZero() ? 0 : adviceSum.dividedBy(areaSum).toNumber(),
        b_area: areaSum.toNumber(),
      }
    } else {
      result[nutrient] = {
        dose: doseSum.toNumber(),
        advice: adviceSum.toNumber(),
        b_area: areaSum.toNumber(),
      }
    }
  }

  return result
}
