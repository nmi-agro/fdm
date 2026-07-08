export type UnitMode = "per_ha" | "total"

export type FieldNutrientValue = {
  /** Applied dose in kg/ha (filling). */
  filling: number
  /** Recommended dose in kg/ha (advice). */
  advice: number
}

export type FieldNutrientRow = {
  b_id: string
  b_name: string
  b_area: number
  mainCultivation: {
    b_lu: string
    b_lu_name: string
    b_lu_croprotation: string | null
  } | null
  /** Set when the advice could not be calculated for this field (e.g. missing cultivation or soil data). */
  errorMessage?: string
  /** Nutrient values keyed by nutrient symbol (e.g. "N", "P", "EOC"). */
  values: Record<string, FieldNutrientValue>
}
