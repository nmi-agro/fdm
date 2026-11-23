/**
 * Farm-wide measure data shared by the measures pages of a farm: the recommended measures
 * per field and, per catalogue measure, the fields on which it is applied, recommended or
 * applicable.
 */
import {
  type Field,
  getCultivations,
  getFields,
  getMeasuresForFarm,
  type MeasureCatalogue,
  type PrincipalId,
  type Timeframe,
} from "@nmi-agro/fdm-core"
import {
  collectFarmMeasureInputs,
  type FarmMeasureInputs,
  type FieldTopOpportunity,
  getFarmMeasureOpportunities,
  getIndicatorsForFarm,
  getMeasureApplicabilityForFields,
  type MeasureApplicabilityInfo,
} from "~/integrations/bln3.server"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { reportError } from "~/lib/error"
import {
  type FieldMeasureEntry,
  type FieldMeasureStatus,
  mergeFieldMeasureStatus,
} from "~/lib/farm-measures"
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
  /** `false` when the advice of no field could be loaded */
  adviceAvailable: boolean
}

/** The arguments of {@link getFarmNextSteps}. */
type FarmNextStepsArgs = {
  principal_id: PrincipalId
  b_id_farm: string
  fields: { b_id: string; b_name: string | null }[]
  b_year: number
  timeframe?: Timeframe
  measuresMap: Map<string, { m_id: string }[]>
  catalogue: { m_id: string; m_name: string }[]
  farmFields?: Field[]
  /** The inputs from `collectFarmMeasureInputs`, covering at least the fields. */
  measureInputs?: Promise<FarmMeasureInputs>
  /** The applicability per field; fields that are missing or `null` are requested again. */
  applicabilityByField?:
    | Record<string, Record<string, MeasureApplicabilityInfo> | null>
    | Promise<Record<string, Record<string, MeasureApplicabilityInfo> | null>>
  scores?: ReturnType<typeof getIndicatorsForFarm>
}

/**
 * Builds the farm-wide measure recommendations: per field the measures that improve its weak
 * indicators most, with one variant per measure family chosen over the whole farm.
 *
 * Pass `farmFields`, `measureInputs` and `applicabilityByField` when the caller already loaded
 * them, to avoid loading the fields, the inputs and the applicability a second time. Pass
 * `scores` when the caller already started loading the BLN3 scores, so they load in parallel with
 * the caller's own requests.
 *
 * @returns The ranked steps, the opportunities per field, the farm-wide opportunities, the
 *   summed impact per measure and indicator, and whether any advice could be loaded.
 */
export async function getFarmNextSteps(args: FarmNextStepsArgs): Promise<FarmRecommendationsData> {
  const { recommendations } = await buildFarmNextSteps(args)
  return recommendations
}

/**
 * Builds the farm-wide measure recommendations, see {@link getFarmNextSteps}, and also returns
 * the applicability per field that was used, including the fields that were requested again.
 */
async function buildFarmNextSteps({
  principal_id,
  b_id_farm,
  fields,
  b_year,
  timeframe,
  measuresMap,
  catalogue,
  farmFields,
  measureInputs,
  applicabilityByField: knownApplicabilityByField,
  scores: preloadedScores,
}: FarmNextStepsArgs): Promise<{
  recommendations: FarmRecommendationsData
  applicabilityByField: Record<string, Record<string, MeasureApplicabilityInfo> | null>
}> {
  const b_ids = fields.map((f) => f.b_id)
  // The scores are only needed after the NMI requests, so they load at the same time
  const scoreByBid = (
    preloadedScores ??
    getIndicatorsForFarm({
      principal_id,
      b_id_farm,
      timeframe,
      preloadedFields: farmFields,
    })
  ).then((scores) => new Map(scores.map((s) => [s.b_id, s.score])))
  // Avoid an unhandled rejection when the opportunities fail first; it is awaited there
  scoreByBid.catch(() => undefined)
  const indicatorNameById = new Map(INDICATORS.map((i) => [i.id, i.name]))
  const fieldNameByBid = new Map(fields.map((f) => [f.b_id, f.b_name]))
  const activeMeasureIdsByField = new Map(
    b_ids.map((b_id) => [b_id, new Set((measuresMap.get(b_id) ?? []).map((m) => m.m_id))]),
  )
  const { candidates, adviceAvailable, applicabilityByField } = await getFarmMeasureOpportunities(
    {
      principal_id,
      b_id_farm,
      b_ids,
      b_year,
      timeframe,
      scoreByBid,
      activeMeasureIdsByField,
      measureNameById: new Map(catalogue.map((m) => [m.m_id, m.m_name])),
      measureInputs,
      applicabilityByField: knownApplicabilityByField,
    },
  )

  // Show one variant per measure family farm-wide: the variant with the highest
  // impact summed over all eligible candidates of all fields (not only each
  // field's winner). The winning variant is listed on every field where it is
  // eligible, also where another variant of that family scored best.
  const bestVariantIds = getFarmBestVariantIds(
    candidates.map((c) => ({ b_id: c.b_id, m_id: c.m_id, impact: c.aggregateImpact })),
  )
  // A measure is only recommended on a field where it improves the weak indicators, as on the
  // field pages. Candidates without a positive impact still counted in the variant choice above.
  const opportunities = candidates.filter(
    (c) => bestVariantIds.has(c.m_id) && c.aggregateImpact > 0,
  )

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

  return {
    recommendations: { steps, opportunitiesByField, topOpportunities, measureImpacts, adviceAvailable },
    applicabilityByField,
  }
}

export type { FieldMeasureEntry, FieldMeasureStatus }

export type FarmMeasureStatus = {
  /** Per catalogue ID, the fields with their status for that measure */
  fieldsByMeasure: Map<string, FieldMeasureEntry[]>
  /** `false` when the recommendations could not be loaded */
  recommendationsAvailable: boolean
  /** `false` when the applicability could not be loaded for one or more fields */
  applicabilityAvailable: boolean
  /** Number of fields that BLN3 scores, i.e. the fields that can get a recommendation */
  eligibleFieldCount: number
  /** Number of those fields whose applicability could not be loaded */
  applicabilityFailedFieldCount: number
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
 * Pass `measuresMap` when the caller already loaded the measures of the farm, to avoid loading
 * them a second time.
 *
 * A complete result is kept for {@link STATUS_CACHE_TTL_MS} per user, farm and year, so opening
 * several measures of the catalogue does not collect the input of every field again for each
 * page. The key includes the measures applied on the farm, so adding, changing or removing a
 * measure gives a fresh result right away. A result with missing recommendations or applicability
 * is not kept, so "Opnieuw proberen" always loads again.
 *
 * @returns The fields per measure and whether recommendations and applicability were available.
 */
export async function getFarmMeasureStatus({
  principal_id,
  b_id_farm,
  calendar,
  timeframe,
  catalogue,
  measuresMap: preloadedMeasuresMap,
}: {
  principal_id: PrincipalId
  b_id_farm: string
  calendar: string
  timeframe: Timeframe
  catalogue: MeasureCatalogue[]
  measuresMap?: Awaited<ReturnType<typeof getMeasuresForFarm>>
}): Promise<FarmMeasureStatus> {
  const measuresMap =
    preloadedMeasuresMap ?? (await getMeasuresForFarm(fdm, principal_id, b_id_farm, timeframe))
  const key = getStatusCacheKey(principal_id, b_id_farm, calendar, measuresMap)

  const now = Date.now()
  for (const [cachedKey, entry] of statusCache) {
    if (entry.expires <= now) statusCache.delete(cachedKey)
  }
  const cached = statusCache.get(key)
  if (cached) return cached.status

  // The promise is kept, so requests that arrive while it loads share it
  const status = loadFarmMeasureStatus({
    principal_id,
    b_id_farm,
    calendar,
    timeframe,
    catalogue,
    measuresMap,
  })
  statusCache.set(key, { expires: now + STATUS_CACHE_TTL_MS, status })
  status.then(
    (result) => {
      if (!result.recommendationsAvailable || !result.applicabilityAvailable) {
        statusCache.delete(key)
      }
    },
    () => statusCache.delete(key),
  )
  return status
}

/** How long a complete farm measure status is reused: long enough to open a few measures. */
const STATUS_CACHE_TTL_MS = 2 * 60 * 1000

/** Farm measure status per user, farm, year and applied measures; see {@link getFarmMeasureStatus}. */
const statusCache = new Map<string, { expires: number; status: Promise<FarmMeasureStatus> }>()

/**
 * Builds the cache key of a farm measure status. It includes the user, because the fields a user
 * may see differ, and every applied measure with its period, because they change the status.
 */
function getStatusCacheKey(
  principal_id: PrincipalId,
  b_id_farm: string,
  calendar: string,
  measuresMap: Awaited<ReturnType<typeof getMeasuresForFarm>>,
): string {
  const applied = [...measuresMap]
    .flatMap(([b_id, measures]) =>
      measures.map(
        (measure) =>
          `${b_id}:${measure.m_id}:${measure.m_start?.valueOf() ?? ""}:${measure.m_end?.valueOf() ?? ""}`,
      ),
    )
    .sort()
    .join(",")
  return JSON.stringify([principal_id, b_id_farm, calendar, applied])
}

/** Loads the farm measure status without the cache; see {@link getFarmMeasureStatus}. */
async function loadFarmMeasureStatus({
  principal_id,
  b_id_farm,
  calendar,
  timeframe,
  catalogue,
  measuresMap,
}: {
  principal_id: PrincipalId
  b_id_farm: string
  calendar: string
  timeframe: Timeframe
  catalogue: MeasureCatalogue[]
  measuresMap: Awaited<ReturnType<typeof getMeasuresForFarm>>
}): Promise<FarmMeasureStatus> {
  const fields = await getFields(fdm, principal_id, b_id_farm, timeframe)
  // The BLN3 scores do not depend on the applicability, so they load while it is fetched below
  const scores = getIndicatorsForFarm({
    principal_id,
    b_id_farm,
    timeframe,
    preloadedFields: fields,
  })
  // Handled where the recommendations await it; this only keeps an early rejection from being
  // reported as unhandled while the applicability is still loading
  scores.catch(() => undefined)
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

  // The inputs and the applicability are loaded once and reused for the recommendations. With
  // `reportFailures`, a field whose NMI request failed is `null`, so a failure is not mistaken
  // for "no applicable measures".
  const eligibleIds = eligibleFields.map((field) => field.b_id)
  const measureInputs = collectFarmMeasureInputs({
    principal_id,
    b_id_farm,
    b_ids: eligibleIds,
    b_year,
    timeframe,
  })
  const loadedApplicability = await measureInputs
    .then((inputs) => getMeasureApplicabilityForFields(inputs, { reportFailures: true }))
    .catch((error) => {
      reportError(error, { page: "measures catalogue applicability" })
      return {} as Record<string, Record<string, MeasureApplicabilityInfo> | null>
    })

  // The recommendations request the fields whose applicability failed again
  const nextSteps = await buildFarmNextSteps({
    principal_id,
    b_id_farm,
    fields: eligibleFields,
    b_year,
    timeframe,
    measuresMap,
    catalogue,
    farmFields: fields,
    measureInputs,
    applicabilityByField: loadedApplicability,
    scores,
  }).catch((error) => {
    reportError(error, { page: "measures catalogue recommendations" })
    return null
  })
  const recommendations = nextSteps?.recommendations ?? null
  // Without eligible fields there is nothing to recommend, which is not a failure
  const recommendationsAvailable =
    eligibleFields.length === 0 || (recommendations?.adviceAvailable ?? false)

  // Use the applicability after those retries, so the statuses and the notice agree with the
  // recommendations. A field that is still missing or `null` could not be loaded.
  const applicabilityByField = nextSteps?.applicabilityByField ?? loadedApplicability
  let applicabilityFailedFieldCount = eligibleIds.filter(
    (b_id) => !applicabilityByField[b_id],
  ).length
  // Without an NMI API key the lookup returns empty records, which are not a real result
  if (!getNmiApiKey()) applicabilityFailedFieldCount = eligibleIds.length
  const applicabilityAvailable = applicabilityFailedFieldCount === 0

  const fieldsByMeasure = mergeFieldMeasureStatus({
    fieldNames,
    measuresMap,
    opportunitiesByField: recommendations?.opportunitiesByField ?? {},
    applicabilityByField,
  })

  return {
    fieldsByMeasure,
    recommendationsAvailable,
    applicabilityAvailable,
    eligibleFieldCount: eligibleFields.length,
    applicabilityFailedFieldCount,
  }
}
