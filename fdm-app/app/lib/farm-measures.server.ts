/**
 * Farm-wide measure data shared by the measures pages of a farm: the recommended measures
 * per field and, per catalogue measure, the fields on which it is applied, recommended or
 * applicable.
 */
import {
  getCultivations,
  getFields,
  getMeasuresForFarm,
  type MeasureCatalogue,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import {
  type FieldTopOpportunity,
  getFarmMeasureOpportunities,
  getIndicatorsForFarm,
  getMeasureApplicabilityForFields,
} from "~/integrations/bln3.server"
import { reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { getFarmBestVariantIds, INDICATORS, isExcludedFromBln3 } from "~/lib/indicators"

/** A ranked measure × field recommendation for the farm-wide "Aanbevolen
 * maatregelen" card, derived from `getTopOpportunitiesForField` run per
 * field then flattened across the farm — deliberately cross-field and
 * cross-indicator, matching the "whole farm" framing of the measures page. */
type FarmNextStep = {
  b_id: string
  b_name: string | null
  m_id: string
  m_name: string
  indicatorName: string
  aggregateImpact: number
}

export type FarmRecommendationsData = {
  steps: FarmNextStep[]
  opportunitiesByField: Record<string, FieldTopOpportunity[]>
  topOpportunities: FieldTopOpportunity[]
  measureImpacts: Record<string, { indicator_id: string; measure_impact: number }[]>
}

/**
 * Builds the farm-wide measure recommendations: per field the measures that improve its weak
 * indicators most, with one variant per measure family chosen over the whole farm.
 *
 * @returns The ranked steps, the opportunities per field, the farm-wide opportunities and the
 *   summed impact per measure and indicator.
 */
export async function getFarmNextSteps({
  principal_id,
  b_id_farm,
  fields,
  b_year,
  timeframe,
  measuresMap,
  catalogue,
}: {
  principal_id: PrincipalId
  b_id_farm: string
  fields: { b_id: string; b_name: string | null }[]
  b_year: number
  timeframe?: Timeframe
  measuresMap: Map<string, { m_id: string }[]>
  catalogue: { m_id: string; m_name: string }[]
}): Promise<FarmRecommendationsData> {
  const b_ids = fields.map((f) => f.b_id)
  const scores = await getIndicatorsForFarm({ principal_id, b_id_farm, timeframe })
  const indicatorNameById = new Map(INDICATORS.map((i) => [i.id, i.name]))
  const scoreByBid = new Map(scores.map((s) => [s.b_id, s.score]))
  const fieldNameByBid = new Map(fields.map((f) => [f.b_id, f.b_name]))
  const activeMeasureIdsByField = new Map(
    b_ids.map((b_id) => [b_id, new Set((measuresMap.get(b_id) ?? []).map((m) => m.m_id))]),
  )
  const { candidates } = await getFarmMeasureOpportunities({
    principal_id,
    b_ids,
    b_year,
    timeframe,
    scoreByBid,
    activeMeasureIdsByField,
    measureNameById: new Map(catalogue.map((m) => [m.m_id, m.m_name])),
  })

  // Show one variant per measure family farm-wide: the variant with the highest
  // impact summed over all eligible candidates of all fields (not only each
  // field's winner). The winning variant is listed on every field where it is
  // eligible, also where another variant of that family scored best.
  const bestVariantIds = getFarmBestVariantIds(
    candidates.map((c) => ({ b_id: c.b_id, m_id: c.m_id, impact: c.aggregateImpact })),
  )
  const opportunities = candidates.filter((c) => bestVariantIds.has(c.m_id))

  const opportunitiesByField: Record<string, FieldTopOpportunity[]> = {}
  const farmOpportunitiesByMId = new Map<string, FieldTopOpportunity>()
  const measureImpacts: Record<string, { indicator_id: string; measure_impact: number }[]> = {}

  for (const opp of opportunities) {
    if (!opportunitiesByField[opp.b_id]) {
      opportunitiesByField[opp.b_id] = []
    }
    opportunitiesByField[opp.b_id].push({
      m_id: opp.m_id,
      aggregateImpact: opp.aggregateImpact,
      indicatorImpacts: opp.indicatorImpacts,
    })

    const existing = farmOpportunitiesByMId.get(opp.m_id)
    if (existing) {
      existing.aggregateImpact += opp.aggregateImpact
      for (const indImpact of opp.indicatorImpacts) {
        const existingInd = existing.indicatorImpacts.find(
          (i) => i.indicator_id === indImpact.indicator_id,
        )
        if (existingInd) {
          existingInd.measure_impact += indImpact.measure_impact
        } else {
          existing.indicatorImpacts.push({ ...indImpact })
        }
      }
    } else {
      farmOpportunitiesByMId.set(opp.m_id, {
        m_id: opp.m_id,
        aggregateImpact: opp.aggregateImpact,
        indicatorImpacts: opp.indicatorImpacts.map((i) => ({ ...i })),
      })
    }

    for (const indImpact of opp.indicatorImpacts) {
      if (!measureImpacts[opp.m_id]) {
        measureImpacts[opp.m_id] = []
      }
      const existing = measureImpacts[opp.m_id].find(
        (i) => i.indicator_id === indImpact.indicator_id,
      )
      if (existing) {
        existing.measure_impact += indImpact.measure_impact
      } else {
        measureImpacts[opp.m_id].push({
          indicator_id: indImpact.indicator_id,
          measure_impact: indImpact.measure_impact,
        })
      }
    }
  }

  for (const impacts of Object.values(measureImpacts)) {
    impacts.sort((a, b) => b.measure_impact - a.measure_impact)
  }

  const topOpportunities = [...farmOpportunitiesByMId.values()].sort(
    (a, b) => b.aggregateImpact - a.aggregateImpact,
  )

  const steps = opportunities
    .map((opportunity) => {
      const topIndicatorId = [...opportunity.indicatorImpacts].sort(
        (a, b) => b.measure_impact - a.measure_impact,
      )[0]?.indicator_id
      return {
        b_id: opportunity.b_id,
        b_name: fieldNameByBid.get(opportunity.b_id) ?? null,
        m_id: opportunity.m_id,
        m_name: opportunity.m_name,
        indicatorName: topIndicatorId
          ? (indicatorNameById.get(topIndicatorId) ?? topIndicatorId)
          : "",
        aggregateImpact: opportunity.aggregateImpact,
      }
    })
    .sort((a, b) => b.aggregateImpact - a.aggregateImpact)

  return { steps, opportunitiesByField, topOpportunities, measureImpacts }
}

/** Status of a measure on a field, in order of priority. */
export type FieldMeasureStatus = "applied" | "recommended" | "applicable"

/** A field with the status of one measure on it. */
export type FieldMeasureEntry = {
  b_id: string
  b_name: string | null
  status: FieldMeasureStatus
  /** Period of the measure, only for `applied` */
  m_start?: Date | null
  m_end?: Date | null
}

export type FarmMeasureStatus = {
  /** Per catalogue ID, the fields with their status for that measure */
  fieldsByMeasure: Map<string, FieldMeasureEntry[]>
  /** `false` when the recommendations could not be loaded */
  recommendationsAvailable: boolean
  /** `false` when the applicability could not be loaded */
  applicabilityAvailable: boolean
}

const STATUS_ORDER: Record<FieldMeasureStatus, number> = {
  applied: 0,
  recommended: 1,
  applicable: 2,
}

/**
 * Determines for every catalogue measure on which fields of a farm it is applied, recommended
 * or applicable in a calendar year. Each field gets one status per measure:
 *
 * - `applied`: the measure is active on the field in the year;
 * - `recommended`: not applied, and listed under the farm's "Aanbevolen maatregelen";
 * - `applicable`: not applied or recommended, but applicable according to the applicability check.
 *
 * Recommendations and applicability use the same NMI calls and rules as the farm's measures
 * page, and skip fields that BLN3 does not score (buffer strips, nature). A failure of either
 * call is reported and leaves that status empty, with the matching flag set to `false`.
 *
 * @returns The fields per measure and whether recommendations and applicability were available.
 */
export async function getFarmMeasureStatus({
  principal_id,
  b_id_farm,
  calendar,
  timeframe,
  catalogue,
}: {
  principal_id: PrincipalId
  b_id_farm: string
  calendar: string
  timeframe: Timeframe
  catalogue: MeasureCatalogue[]
}): Promise<FarmMeasureStatus> {
  const [fields, measuresMap] = await Promise.all([
    getFields(fdm, principal_id, b_id_farm, timeframe),
    getMeasuresForFarm(fdm, principal_id, b_id_farm, timeframe),
  ])
  const fieldNames = new Map(fields.map((field) => [field.b_id, field.b_name ?? null]))
  const calendarYear = Number(calendar)
  const b_year = Number.isFinite(calendarYear) ? calendarYear : new Date().getFullYear()

  const cultivations = await Promise.all(
    fields.map((field) => getCultivations(fdm, principal_id, field.b_id)),
  )
  const eligibleFields = fields
    .filter((field, index) => {
      const main = getMainCultivation(cultivations[index], calendar)
      return !isExcludedFromBln3({
        b_bufferstrip: field.b_bufferstrip,
        b_lu_croprotation: main?.b_lu_croprotation,
        b_lu_catalogue: main?.b_lu_catalogue,
      })
    })
    .map((field) => ({ b_id: field.b_id, b_name: field.b_name ?? null }))

  let applicabilityAvailable = true
  let recommendationsAvailable = true
  const [applicabilityByField, recommendations] = await Promise.all([
    getMeasureApplicabilityForFields({
      principal_id,
      b_ids: eligibleFields.map((field) => field.b_id),
      b_year,
      timeframe,
    }).catch((error) => {
      reportError(error, { page: "measures catalogue applicability" })
      applicabilityAvailable = false
      return {}
    }),
    getFarmNextSteps({
      principal_id,
      b_id_farm,
      fields: eligibleFields,
      b_year,
      timeframe,
      measuresMap,
      catalogue,
    }).catch((error) => {
      reportError(error, { page: "measures catalogue recommendations" })
      recommendationsAvailable = false
      return null
    }),
  ])

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
  for (const [b_id, opportunities] of Object.entries(recommendations?.opportunitiesByField ?? {})) {
    for (const opportunity of opportunities) {
      set(opportunity.m_id, { b_id, b_name: fieldNames.get(b_id) ?? null, status: "recommended" })
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

  return { fieldsByMeasure, recommendationsAvailable, applicabilityAvailable }
}
