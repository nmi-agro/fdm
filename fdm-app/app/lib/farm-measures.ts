/**
 * The status of catalogue measures on the fields of a farm, without server dependencies: the
 * types and the rules that combine applied measures, recommendations and applicability into one
 * status per field and measure. `farm-measures.server.ts` loads the data and applies these rules.
 */

/** Status of a measure on a field, from strongest to weakest. */
export type FieldMeasureStatus = "applied" | "recommended" | "applicable"

/** A field with the status of one measure on it. */
export type FieldMeasureEntry = {
  b_id: string
  b_name: string | null
  status: FieldMeasureStatus
  /** Period of the measure, only for `applied` */
  m_start?: Date | null
  m_end?: Date | null
  /**
   * Only for `recommended`: IDs of the indicators of the field that the measure improves,
   * e.g. `NUT_N`, ordered from the largest to the smallest improvement.
   */
  indicatorIds?: string[]
}

const STATUS_ORDER: Record<FieldMeasureStatus, number> = {
  applied: 0,
  recommended: 1,
  applicable: 2,
}

/** Input of {@link mergeFieldMeasureStatus}. */
export type FieldMeasureStatusSources = {
  /** Field names per field ID */
  fieldNames: Map<string, string | null>
  /** Measures applied per field ID */
  measuresMap: Map<string, { m_id: string; m_start: Date | null; m_end: Date | null }[]>
  /** Recommended measures per field ID, with their impact per indicator */
  opportunitiesByField: Record<
    string,
    { m_id: string; indicatorImpacts: { indicator_id: string; measure_impact: number }[] }[]
  >
  /** Applicability per field ID and measure ID; `null` when it could not be loaded for a field */
  applicabilityByField: Record<string, Record<string, { applicability: string }> | null>
}

/**
 * Combines applied measures, recommendations and applicability into one status per field and
 * measure. A stronger status wins: `applied` over `recommended` over `applicable`. Only measures
 * whose applicability is `"applicable"` count as applicable. For a recommendation, the indicators
 * that the measure improves are listed from the largest to the smallest improvement.
 *
 * @param sources - The applied measures, recommendations and applicability of the farm.
 * @returns Per measure ID the fields with their status, ordered by status and then field name.
 */
export function mergeFieldMeasureStatus({
  fieldNames,
  measuresMap,
  opportunitiesByField,
  applicabilityByField,
}: FieldMeasureStatusSources): Map<string, FieldMeasureEntry[]> {
  const statusByMeasure = new Map<string, Map<string, FieldMeasureEntry>>()
  const set = (m_id: string, entry: FieldMeasureEntry) => {
    const perField = statusByMeasure.get(m_id) ?? new Map<string, FieldMeasureEntry>()
    const current = perField.get(entry.b_id)
    if (!current || STATUS_ORDER[entry.status] < STATUS_ORDER[current.status]) {
      perField.set(entry.b_id, entry)
    }
    statusByMeasure.set(m_id, perField)
  }

  for (const [b_id, measures] of measuresMap) {
    for (const measure of measures) {
      set(measure.m_id, {
        b_id,
        b_name: fieldNames.get(b_id) ?? null,
        status: "applied",
        m_start: measure.m_start,
        m_end: measure.m_end,
      })
    }
  }
  for (const [b_id, opportunities] of Object.entries(opportunitiesByField)) {
    for (const opportunity of opportunities) {
      set(opportunity.m_id, {
        b_id,
        b_name: fieldNames.get(b_id) ?? null,
        status: "recommended",
        indicatorIds: opportunity.indicatorImpacts
          .filter((impact) => impact.measure_impact > 0)
          .sort((a, b) => b.measure_impact - a.measure_impact)
          .map((impact) => impact.indicator_id),
      })
    }
  }
  for (const [b_id, perMeasure] of Object.entries(applicabilityByField)) {
    for (const [m_id, info] of Object.entries(perMeasure ?? {})) {
      if (info.applicability !== "applicable") continue
      set(m_id, { b_id, b_name: fieldNames.get(b_id) ?? null, status: "applicable" })
    }
  }

  const fieldsByMeasure = new Map<string, FieldMeasureEntry[]>()
  for (const [m_id, perField] of statusByMeasure) {
    fieldsByMeasure.set(
      m_id,
      [...perField.values()].sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.b_name ?? "").localeCompare(b.b_name ?? "", "nl"),
      ),
    )
  }
  return fieldsByMeasure
}
