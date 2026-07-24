import type { Geometry } from "geojson"
import { NormNotApplicableError } from "@nmi-agro/fdm-calculator"
import {
  calculateDose,
  calculateNitrogenBalance,
  calculateOrganicMatterBalance,
  collectInputForNitrogenBalance,
  collectInputForOrganicMatterBalance,
  getNutrientAdvice,
  getSoilParameterEstimates,
} from "@nmi-agro/fdm-calculator"
import {
  checkPermission,
  getCultivations,
  getCultivationsForFarm,
  getCurrentSoilData,
  getField,
  getFields,
  getFertilizerApplications,
  getFertilizers,
  getHarvests,
  getMeasures,
  getParametersForHarvestCat,
  getSoilAnalyses,
  getSoilParametersDescription,
  listAvailableAcquiringMethods,
} from "@nmi-agro/fdm-core"
import { getCultivationCatalogue } from "@nmi-agro/fdm-data"
import { simplify } from "@turf/simplify"
import { useEffect } from "react"
import { data, type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import type { CultivationHistory } from "~/components/blocks/atlas-fields/cultivation-history"
import type {
  AsyncTileResult,
  FieldDashboardBlnSummary,
  FieldDashboardCultivationHistoryEntry,
  FieldDashboardData,
  FieldDashboardFertilizerAsyncSummary,
  FieldDashboardNitrogenBalanceSummary,
  FieldDashboardNormSummary,
  FieldDashboardNutrientAdviceSummary,
  FieldDashboardOrganicMatterBalanceSummary,
} from "~/components/blocks/field-dashboard/types"
import type { CultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"
import {
  buildFieldDashboardRegistry,
  FIELD_DASHBOARD_SECTIONS,
} from "~/components/blocks/field-dashboard/registry"
import { FieldDashboardSectionHeading } from "~/components/blocks/field-dashboard/tile"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import {
  getEffectiveHarvestable,
  getHarvestDateTerm,
  getHarvestTerm,
} from "~/components/blocks/harvest/utils"
import { constructSoilDataCards } from "~/components/blocks/soil/cards"
import {
  getSoilAnalysisDownloadName,
  getSoilAnalysisTitle,
} from "~/components/blocks/soil/download"
import { useAnalytics } from "~/hooks/use-analytics"
import { getIndicatorsForField } from "~/integrations/bln3.server"
import { getNorms } from "~/integrations/calculator"
import { getMapStyle } from "~/integrations/map"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getFieldAggregationScore } from "~/lib/aggregations"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { computeBcs } from "~/lib/bcs.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getCultivationSuggestionResult } from "~/lib/cultivation-suggestion.server"
import { handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { getScoreTier, getScoreVerdict, scoreToDisplay } from "~/lib/indicators"
import { cn } from "~/lib/utils"

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const fieldName = loaderData?.field?.b_name ?? "Perceel"
  return [
    { title: `${fieldName} | Dashboard | ${clientConfig.name}` },
    {
      name: "description",
      content: `Overzicht van perceel ${fieldName} met teelt, bemesting, bodem en maatregelen.`,
    },
  ]
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return undefined
  return value instanceof Date ? value : new Date(value)
}

function buildErrorResult<T>(message: string): AsyncTileResult<T> {
  return { status: "error", message }
}

// Sanitizes thrown errors before surfacing them to the client: logs/reports the real error via
// `reportError` (Sentry + console), but returns a generic Dutch message so no internal exception
// text (stack traces, SQL errors, etc.) ever reaches the browser.
function buildSanitizedErrorResult<T>(
  error: unknown,
  tags: Record<string, string>,
  context?: Record<string, unknown>,
): AsyncTileResult<T> {
  reportError(error, tags, context)
  return buildErrorResult("Deze gegevens konden niet worden opgehaald. Probeer het later opnieuw.")
}

function buildUnavailableResult<T>(message: string): AsyncTileResult<T> {
  return { status: "unavailable", message }
}

function buildEmptyResult<T>(message: string): AsyncTileResult<T> {
  return { status: "empty", message }
}

// Shared shape for the nitrogen/organic-matter balance tiles: both check the bufferstrip
// exemption, collect balance input, calculate the farm-wide balance, then pick out and shape
// this field's result. Only the balance-specific collect/calculate functions and the final
// data mapping differ between the two callers.
async function computeFieldBalanceResult<TData>(options: {
  isBufferstrip: boolean
  bufferstripMessage: string
  collectInput: () => Promise<unknown>
  calculate: (
    input: unknown,
  ) => Promise<{ fields: Array<{ b_id: string; errorMessage?: string; balance?: unknown }> }>
  b_id: string
  missingParamsMessage: string
  genericErrorMessage: string
  emptyMessage: string
  mapResult: (fieldResult: { b_id: string; errorMessage?: string; balance?: unknown }) => TData
  reportTags: Record<string, string>
  reportContext: Record<string, unknown>
}): Promise<AsyncTileResult<TData>> {
  const {
    isBufferstrip,
    bufferstripMessage,
    collectInput,
    calculate,
    b_id,
    missingParamsMessage,
    genericErrorMessage,
    emptyMessage,
    mapResult,
    reportTags,
    reportContext,
  } = options

  if (isBufferstrip) {
    return buildUnavailableResult(bufferstripMessage)
  }

  try {
    const input = await collectInput()
    const result = await calculate(input)
    const fieldResult = result.fields.find((entry) => entry.b_id === b_id)

    if (fieldResult?.errorMessage) {
      reportError(fieldResult.errorMessage, reportTags, reportContext)
      return buildErrorResult(
        fieldResult.errorMessage.match(/Missing required soil parameters/)
          ? missingParamsMessage
          : genericErrorMessage,
      )
    }

    if (!fieldResult?.balance) {
      return buildEmptyResult(emptyMessage)
    }

    return { status: "ready", data: mapResult(fieldResult) }
  } catch (error) {
    return buildSanitizedErrorResult(error, reportTags, reportContext)
  }
}

function formatRequirementItem(
  label: string,
  current: number,
  target: number,
  unit: string,
): FieldDashboardNutrientAdviceSummary["items"][number] {
  return {
    label,
    current: Math.round(current),
    target: Math.round(target),
    unit,
  }
}

function formatNormItem(
  label: string,
  used: number,
  limit: number,
  unit: string,
): FieldDashboardNormSummary["items"][number] {
  return {
    label,
    used: Math.round(used),
    limit: Math.round(limit),
    unit,
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    const calendar = params.calendar

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400, statusText: "Farm ID is required" })
    }
    if (!b_id) {
      throw data("Field ID is required", { status: 400, statusText: "Field ID is required" })
    }
    if (!calendar) {
      throw data("Calendar is required", { status: 400, statusText: "Calendar is required" })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const pathname = new URL(request.url).pathname

    const [
      field,
      fields,
      cultivations,
      allCultivations,
      fertilizerApplications,
      fertilizers,
      currentSoilData,
      soilAnalyses,
      measures,
    ] = await Promise.all([
      getField(fdm, session.principal_id, b_id),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivations(fdm, session.principal_id, b_id, timeframe),
      // Fetched without a timeframe to cover the field's full multi-year cultivation history
      getCultivations(fdm, session.principal_id, b_id),
      getFertilizerApplications(fdm, session.principal_id, b_id, timeframe),
      getFertilizers(fdm, session.principal_id, b_id_farm),
      getCurrentSoilData(fdm, session.principal_id, b_id, timeframe),
      getSoilAnalyses(fdm, session.principal_id, b_id, {
        start: null,
        end: timeframe.end,
      }),
      getMeasures(fdm, session.principal_id, b_id, timeframe),
    ])

    if (!field) {
      throw data("Unable to find field", { status: 404, statusText: "Unable to find field" })
    }

    const fieldWritePermission = !!(await checkPermission(
      fdm,
      "field",
      "write",
      b_id,
      session.principal_id,
      pathname,
      false,
    ))

    const farmFieldsGeoJson = {
      type: "FeatureCollection" as const,
      features: fields
        .filter((candidate) => candidate.b_geometry)
        .map((candidate) => ({
          type: "Feature" as const,
          properties: {
            b_id: candidate.b_id,
            b_name: candidate.b_name,
            b_area: candidate.b_area,
          },
          geometry: simplify(candidate.b_geometry as Geometry, {
            tolerance: 0.00001,
            highQuality: true,
          }),
        })),
    }

    const selectedFieldGeoJson = {
      type: "FeatureCollection" as const,
      features: farmFieldsGeoJson.features.filter((feature) => feature.properties.b_id === b_id),
    }

    const harvestEntries = await Promise.all(
      cultivations.map(async (cultivation) => {
        const harvests = await getHarvests(fdm, session.principal_id, cultivation.b_lu, timeframe)
        return [cultivation.b_lu, harvests] as const
      }),
    )
    const harvestsByCultivation = Object.fromEntries(harvestEntries)

    const mainCultivation = getMainCultivation(cultivations, calendar)
    const activeCultivation = mainCultivation ?? null
    const hasDefaultCultivation = !!mainCultivation
    // "not_configured" doubles as "nothing to show" here when a default cultivation already
    // exists — CultivationSuggestionStatusBanner renders null for that status either way.
    // Deferred (not awaited) so a slow/unavailable NMI lookup never blocks the rest of the
    // field dashboard — consumed via `dashboard.asyncInsights.cultivationSuggestion` and an
    // <Await> boundary, same as the other NMI-backed tiles (cultivation history, bln, etc.).
    const cultivationSuggestionPromise: Promise<CultivationSuggestionResult> = hasDefaultCultivation
      ? Promise.resolve({ status: "not_configured" })
      : getCultivationSuggestionResult(
          fdm,
          session.principal_id,
          b_id_farm,
          b_id,
          calendar,
          getNmiApiKey(),
        )

    const cultivationSummary = activeCultivation
      ? {
          id: activeCultivation.b_lu,
          name: activeCultivation.b_lu_name ?? "Onbekend gewas",
          startDate: toIsoString(activeCultivation.b_lu_start),
          endDate: toIsoString(activeCultivation.b_lu_end),
          detailHref: `./cultivation/${activeCultivation.b_lu}`,
          b_lu_croprotation: activeCultivation.b_lu_croprotation,
          b_lu_harvestable: getEffectiveHarvestable(
            activeCultivation.b_lu_harvestable,
            activeCultivation.b_lu_croprotation,
          ),
          harvestTermPlural: getHarvestTerm(activeCultivation.b_lu_croprotation, true),
          harvestDateTerm: getHarvestDateTerm(activeCultivation.b_lu_croprotation),
          harvests: (harvestsByCultivation[activeCultivation.b_lu] ?? [])
            .slice()
            .sort(
              (
                a: (typeof harvestsByCultivation)[string][number],
                b: (typeof harvestsByCultivation)[string][number],
              ) =>
                new Date(b.b_lu_harvest_date ?? 0).getTime() -
                new Date(a.b_lu_harvest_date ?? 0).getTime(),
            )
            .map((harvest: (typeof harvestsByCultivation)[string][number]) => {
              const parameters = getParametersForHarvestCat(activeCultivation.b_lu_harvestcat)
              const analyses = harvest.harvestable?.harvestable_analyses?.[0]
              const metrics = parameters
                .map((parameter) => ({
                  label: parameter,
                  value: analyses?.[parameter],
                }))
                .filter((metric) => metric.value != null)
                .slice(0, 3)
                .map((metric) => ({
                  label: getHarvestParameterLabel(metric.label),
                  value: String(metric.value),
                }))

              return {
                id: harvest.b_id_harvesting,
                date: toIsoString(harvest.b_lu_harvest_date),
                detailHref: `./cultivation/${activeCultivation.b_lu}/harvest/${harvest.b_id_harvesting}`,
                metrics,
              }
            }),
        }
      : null

    const cultivationYears = allCultivations.flatMap((cultivation) => {
      const startYear = toDate(cultivation.b_lu_start)?.getFullYear()
      const endYear = toDate(cultivation.b_lu_end)?.getFullYear()
      return [startYear, endYear].filter((year): year is number => year != null)
    })
    const minYear = cultivationYears.length > 0 ? Math.min(...cultivationYears) : Number(calendar)
    const maxYear = cultivationYears.length > 0 ? Math.max(...cultivationYears) : Number(calendar)

    const fdmCultivationHistory: CultivationHistory[] = []
    for (let year = maxYear; year >= minYear; year--) {
      // Use the same hoofdteelt rule as the rest of the app, rather than grouping by start
      // date, so multi-cultivation years resolve to the one considered active.
      const cultivationForYear = getMainCultivation(allCultivations, String(year))
      if (!cultivationForYear) continue
      fdmCultivationHistory.push({
        year,
        b_lu_catalogue: cultivationForYear.b_lu_catalogue,
        b_lu_name: cultivationForYear.b_lu_name ?? undefined,
        b_lu_croprotation: cultivationForYear.b_lu_croprotation ?? undefined,
        b_lu_rest_oravib: cultivationForYear.b_lu_rest_oravib ?? false,
      })
    }

    const dose = calculateDose({
      applications: fertilizerApplications,
      fertilizers,
    }).dose

    const filteredSoilAnalyses = soilAnalyses.filter((analysis) => !isBcsAnalysis(analysis))
    const sourceParam = getSoilParametersDescription().find((item) => item.parameter === "a_source")
    const basisCards = constructSoilDataCards(currentSoilData, getSoilParametersDescription())
      .filter((card) =>
        ["b_soiltype_agr", "a_som_loi", "a_p_al", "a_p_cc", "a_clay_mi"].includes(card.parameter),
      )
      .map((card) => ({
        ...card,
        date: toIsoString(card.date),
        sourceLabel:
          sourceParam?.options?.find((option) => option.value === card.source)?.label ??
          card.source ??
          "Onbekend",
      }))

    const latestAnalysis = filteredSoilAnalyses
      .slice()
      .sort(
        (a, b) =>
          new Date(b.b_sampling_date ?? b.a_date ?? 0).getTime() -
          new Date(a.b_sampling_date ?? a.a_date ?? 0).getTime(),
      )[0]

    const latestAnalysisPdf = latestAnalysis?.a_file_path
      ? {
          a_id: latestAnalysis.a_id,
          filename: getSoilAnalysisDownloadName(
            latestAnalysis,
            field.b_name,
            getSoilParametersDescription(),
          ),
          title: getSoilAnalysisTitle(latestAnalysis, getSoilParametersDescription()),
        }
      : null

    const measuredCount = filteredSoilAnalyses.filter(
      (analysis) =>
        analysis.a_source && analysis.a_source !== "nl-other-nmi" && analysis.a_source !== "other",
    ).length
    const estimatedCount = filteredSoilAnalyses.filter(
      (analysis) => analysis.a_source === "nl-other-nmi",
    ).length
    const unknownCount = filteredSoilAnalyses.length - measuredCount - estimatedCount

    const latestBcsAnalysis = soilAnalyses
      .filter((analysis) => isBcsAnalysis(analysis))
      .slice()
      .sort(
        (a, b) =>
          new Date(b.b_sampling_date ?? b.a_date ?? 0).getTime() -
          new Date(a.b_sampling_date ?? a.a_date ?? 0).getTime(),
      )[0]

    const bcsSummary = latestBcsAnalysis
      ? {
          scores: latestBcsAnalysis,
          ...computeBcs(latestBcsAnalysis),
          measuredAt: toIsoString(latestBcsAnalysis.b_sampling_date ?? latestBcsAnalysis.a_date),
        }
      : null

    const cultivationHistoryPromise = (async (): Promise<
      AsyncTileResult<FieldDashboardCultivationHistoryEntry[]>
    > => {
      const nmiApiKey = getNmiApiKey()
      const fdmHistoryWithSource: FieldDashboardCultivationHistoryEntry[] =
        fdmCultivationHistory.map((entry) => ({ ...entry, source: "fdm" }))

      if (!nmiApiKey || !field.b_geometry) {
        return fdmHistoryWithSource.length > 0
          ? { status: "ready", data: fdmHistoryWithSource }
          : buildEmptyResult("Nog geen teelthistorie beschikbaar voor dit perceel.")
      }

      try {
        // `field.b_centroid` was already resolved by the `getField` call above — build the
        // estimates input directly instead of re-fetching the field via
        // `collectInputForSoilParameterEstimates` (which would call `getField` again).
        const [a_lon, a_lat] = field.b_centroid
        const [estimates, cultivationCatalogue] = await Promise.all([
          getSoilParameterEstimates(fdm, { a_lat, a_lon, nmiApiKey }),
          getCultivationCatalogue("brp"),
        ])
        const catalogueMap = new Map(
          cultivationCatalogue.map((item) => [item.b_lu_catalogue, item]),
        )
        const fdmYears = new Set(fdmCultivationHistory.map((entry) => entry.year))

        // Fill in years not registered in fdm with NMI's BRP-based cultivation-history estimate
        const nmiHistory: FieldDashboardCultivationHistoryEntry[] = estimates.cultivations
          .filter((cultivation) => !fdmYears.has(cultivation.year))
          .map((cultivation) => {
            const b_lu_catalogue = `nl_${cultivation.b_lu_brp}`
            const catalogueItem = catalogueMap.get(b_lu_catalogue)
            return {
              year: cultivation.year,
              b_lu_catalogue,
              b_lu_name: catalogueItem?.b_lu_name ?? "Onbekend gewas",
              b_lu_croprotation: catalogueItem?.b_lu_croprotation ?? "other",
              b_lu_rest_oravib: catalogueItem?.b_lu_rest_oravib ?? false,
              source: "nmi",
            }
          })

        const merged = [...fdmHistoryWithSource, ...nmiHistory].sort((a, b) => b.year - a.year)

        return merged.length > 0
          ? { status: "ready", data: merged }
          : buildEmptyResult("Nog geen teelthistorie beschikbaar voor dit perceel.")
      } catch (error) {
        // NMI enrichment failed: fall back to the field's own registered history rather than a hard error
        if (fdmHistoryWithSource.length > 0) {
          return { status: "ready", data: fdmHistoryWithSource }
        }
        return buildSanitizedErrorResult(
          error,
          { page: "field-dashboard", scope: "loader", tile: "cultivation-history" },
          { b_id, b_id_farm, timeframe, userId: session.principal_id },
        )
      }
    })()

    // Streamed separately: colours the map by crop rotation without blocking the initial render.
    const fieldCultivationColorsPromise = (async (): Promise<Record<string, string | null>> => {
      try {
        const cultivationsByField = await getCultivationsForFarm(
          fdm,
          session.principal_id,
          b_id_farm,
          timeframe,
        )
        const entries = fields.map((candidate) => {
          if (candidate.b_id === b_id) {
            return [candidate.b_id, activeCultivation?.b_lu_croprotation ?? null] as const
          }
          const fieldCultivations = cultivationsByField.get(candidate.b_id) ?? []
          const active = getMainCultivation(fieldCultivations, calendar) ?? null
          return [candidate.b_id, active?.b_lu_croprotation ?? null] as const
        })
        return Object.fromEntries(entries)
      } catch {
        return {}
      }
    })()

    const fertilizerAsyncPromise = (async (): Promise<FieldDashboardFertilizerAsyncSummary> => {
      const nmiApiKey = getNmiApiKey()

      if (!nmiApiKey) {
        return {
          advice: buildUnavailableResult(
            "Advies is nu niet beschikbaar omdat er geen NMI-koppeling is ingesteld.",
          ),
          norms: buildUnavailableResult(
            "Gebruiksruimte is nu niet beschikbaar omdat de NMI-koppeling voor dit dashboard ontbreekt.",
          ),
        }
      }

      const adviceResult = await (async (): Promise<
        AsyncTileResult<FieldDashboardNutrientAdviceSummary>
      > => {
        if (!activeCultivation) {
          return buildEmptyResult("Voeg eerst een gewas toe om bemestingsadvies te tonen.")
        }

        try {
          const nutrientAdvice = await getNutrientAdvice(fdm, {
            b_lu_catalogue: activeCultivation.b_lu_catalogue,
            b_centroid: field.b_centroid,
            currentSoilData,
            nmiApiKey,
            b_bufferstrip: field.b_bufferstrip,
          })

          return {
            status: "ready",
            data: {
              items: [
                formatRequirementItem("Stikstof", dose.p_dose_n, nutrientAdvice.d_n_req, "kg N"),
                formatRequirementItem("Fosfaat", dose.p_dose_p, nutrientAdvice.d_p_req, "kg P₂O₅"),
                formatRequirementItem("Kalium", dose.p_dose_k, nutrientAdvice.d_k_req, "kg K₂O"),
              ],
            },
          }
        } catch (error) {
          return buildSanitizedErrorResult(
            error,
            { page: "field-dashboard", scope: "loader", tile: "nutrient-advice" },
            { b_id, b_id_farm, timeframe, userId: session.principal_id },
          )
        }
      })()

      const normsResult = await (async (): Promise<AsyncTileResult<FieldDashboardNormSummary>> => {
        if (calendar !== "2025" && calendar !== "2026") {
          return buildUnavailableResult("Gebruiksruimte is alleen beschikbaar voor 2025 en 2026.")
        }

        try {
          const norms = await getNorms({
            fdm,
            principal_id: session.principal_id,
            b_id,
            calendar: calendar as "2025" | "2026",
          })

          return {
            status: "ready",
            data: {
              items: [
                formatNormItem(
                  "Stikstof",
                  norms.filling.nitrogen.normFilling,
                  norms.value.nitrogen.normValue,
                  "kg N",
                ),
                formatNormItem(
                  "Fosfaat",
                  norms.filling.phosphate.normFilling,
                  norms.value.phosphate.normValue,
                  "kg P₂O₅",
                ),
                formatNormItem(
                  "Dierlijke mest",
                  norms.filling.manure.normFilling,
                  norms.value.manure.normValue,
                  "kg N",
                ),
                ...(Number.parseInt(calendar, 10) >= 2026 && norms.value.renure
                  ? [
                      formatNormItem(
                        "Renure",
                        norms.filling.renure?.normFilling ?? 0,
                        norms.value.renure.normValue,
                        "kg N",
                      ),
                    ]
                  : []),
              ],
            },
          }
        } catch (error) {
          if (error instanceof NormNotApplicableError) {
            return buildEmptyResult(String(error).replace("NormNotApplicableError: ", ""))
          }
          return buildSanitizedErrorResult(
            error,
            { page: "field-dashboard", scope: "loader", tile: "norms" },
            { b_id, b_id_farm, timeframe, userId: session.principal_id },
          )
        }
      })()

      return {
        advice: adviceResult,
        norms: normsResult,
      }
    })()

    const blnPromise = (async (): Promise<AsyncTileResult<FieldDashboardBlnSummary>> => {
      const nmiApiKey = getNmiApiKey()
      if (!nmiApiKey) {
        return buildUnavailableResult(
          "BLN is nu niet beschikbaar omdat de NMI-koppeling ontbreekt.",
        )
      }

      try {
        const result = await getIndicatorsForField({
          principal_id: session.principal_id,
          b_id,
          timeframe,
        })

        if (!result.score) {
          return buildEmptyResult("Nog geen BLN-score beschikbaar voor dit perceel.")
        }

        const mainScore01 =
          getFieldAggregationScore(result.score, "S_BLN") ??
          (result.score.indicators.length > 0
            ? result.score.indicators.reduce((sum, indicator) => sum + indicator.score, 0) /
              result.score.indicators.length
            : null)

        if (mainScore01 == null) {
          return buildEmptyResult("Nog geen BLN-score beschikbaar voor dit perceel.")
        }

        const score = scoreToDisplay(mainScore01)
        const attentionCount = result.score.indicators.filter(
          (indicator) => getScoreTier(scoreToDisplay(indicator.score)) !== "green",
        ).length

        const aggregations = [
          { id: "S_WAT_BLN", label: "Water" },
          { id: "S_NUT_BLN", label: "Nutriëntenkringloop" },
          { id: "S_CLIM_BLN", label: "Klimaat" },
          { id: "S_PROD_BLN", label: "Productie" },
        ].map(({ id, label }) => {
          const score01 = getFieldAggregationScore(
            result.score,
            id as Parameters<typeof getFieldAggregationScore>[1],
          )
          return {
            id,
            label,
            score: score01 == null ? null : scoreToDisplay(score01),
          }
        })

        return {
          status: "ready",
          data: {
            score,
            verdict: getScoreVerdict(score),
            attentionCount,
            aggregations,
          },
        }
      } catch (error) {
        return buildSanitizedErrorResult(
          error,
          { page: "field-dashboard", scope: "loader", tile: "bln" },
          { b_id, b_id_farm, timeframe, userId: session.principal_id },
        )
      }
    })()

    const nitrogenBalancePromise = computeFieldBalanceResult<FieldDashboardNitrogenBalanceSummary>({
      isBufferstrip: !!field.b_bufferstrip,
      bufferstripMessage: "Bufferstroken hebben geen stikstofbalans.",
      collectInput: () =>
        collectInputForNitrogenBalance(fdm, session.principal_id, b_id_farm, timeframe, b_id),
      calculate: (input) =>
        calculateNitrogenBalance(fdm, input as Parameters<typeof calculateNitrogenBalance>[1]),
      b_id,
      missingParamsMessage:
        "Voor dit perceel ontbreken bodemparameters die nodig zijn voor de stikstofbalans.",
      genericErrorMessage: "De stikstofbalans kon niet berekend worden voor dit perceel.",
      emptyMessage:
        "Dit perceel was niet in gebruik in dit jaar, dus er is geen stikstofbalans beschikbaar.",
      mapResult: (fieldResult) => {
        const balance = fieldResult.balance as {
          balance: number
          target: number
          supply: { total: number }
          removal: { total: number }
          emission: { ammonia: { total: number }; nitrate: { total: number } }
        }
        return {
          balance: balance.balance,
          target: balance.target,
          supply: balance.supply.total,
          removal: balance.removal.total,
          emissionAmmonia: balance.emission.ammonia.total,
          emissionNitrate: balance.emission.nitrate.total,
          unit: "kg N/ha",
        }
      },
      reportTags: { page: "field-dashboard", scope: "loader", tile: "nitrogen-balance" },
      reportContext: { b_id, b_id_farm, timeframe, userId: session.principal_id },
    })

    const organicMatterBalancePromise =
      computeFieldBalanceResult<FieldDashboardOrganicMatterBalanceSummary>({
        isBufferstrip: !!field.b_bufferstrip,
        bufferstripMessage: "Bufferstroken hebben geen organische stofbalans.",
        collectInput: () =>
          collectInputForOrganicMatterBalance(
            fdm,
            session.principal_id,
            b_id_farm,
            timeframe,
            b_id,
          ),
        calculate: (input) => {
          type InputType = Omit<
            Awaited<ReturnType<typeof collectInputForOrganicMatterBalance>>,
            "timeFrame"
          > & { timeFrame: { start: Date; end: Date } }
          return calculateOrganicMatterBalance(fdm, input as InputType)
        },
        b_id,
        missingParamsMessage:
          "Voor dit perceel ontbreken bodemparameters die nodig zijn voor de organische stofbalans.",
        genericErrorMessage: "De organische stofbalans kon niet berekend worden voor dit perceel.",
        emptyMessage:
          "Dit perceel was niet in gebruik in dit jaar, dus er is geen organische stofbalans beschikbaar.",
        mapResult: (fieldResult) => {
          const balance = fieldResult.balance as {
            balance: number
            supply: { total: number }
            degradation: { total: number }
          }
          return {
            balance: balance.balance,
            supply: balance.supply.total,
            degradation: balance.degradation.total,
            unit: "kg OS/ha",
          }
        },
        reportTags: { page: "field-dashboard", scope: "loader", tile: "organic-matter-balance" },
        reportContext: { b_id, b_id_farm, timeframe, userId: session.principal_id },
      })

    const dashboardData: FieldDashboardData = {
      b_id,
      b_id_farm,
      calendar,
      field,
      fieldWritePermission,
      acquiringMethodOptions: listAvailableAcquiringMethods(),
      mapStyle: getMapStyle("satellite"),
      farmFieldsGeoJson,
      selectedFieldGeoJson,
      cultivation: {
        active: cultivationSummary,
      },
      fertilizer: {
        applicationCount: fertilizerApplications.length,
        lastApplicationDate:
          fertilizerApplications.length > 0
            ? toIsoString(
                fertilizerApplications
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(b.p_app_date ?? 0).getTime() - new Date(a.p_app_date ?? 0).getTime(),
                  )[0].p_app_date,
              )
            : null,
        applications: fertilizerApplications
          .slice()
          .sort(
            (a, b) => new Date(b.p_app_date ?? 0).getTime() - new Date(a.p_app_date ?? 0).getTime(),
          )
          .map((application) => ({
            p_app_id: application.p_app_id,
            p_name: application.p_name_nl ?? "Onbekende meststof",
            date: toIsoString(application.p_app_date),
            amount: application.p_app_amount_display ?? application.p_app_amount,
            unit: application.p_app_amount_unit,
          })),
      },
      soil: {
        parameterCards: basisCards,
        analysisCount: filteredSoilAnalyses.length,
        latestAnalysisDate: toIsoString(latestAnalysis?.b_sampling_date ?? latestAnalysis?.a_date),
        latestAnalysisPdf,
        measuredCount,
        estimatedCount,
        unknownCount,
        bcs: bcsSummary,
      },
      measures: {
        items: measures.map((measure) => ({
          b_id_measure: measure.b_id_measure,
          m_name: measure.m_name,
          m_summary: measure.m_summary,
          m_start: toIsoString(measure.m_start),
          m_end: toIsoString(measure.m_end),
        })),
        activeCount: measures.length,
        ongoingCount: measures.filter((measure) => !measure.m_end).length,
        endedCount: measures.filter((measure) => !!measure.m_end).length,
      },
      asyncInsights: {
        fertilizer: fertilizerAsyncPromise,
        bln: blnPromise,
        cultivationHistory: cultivationHistoryPromise,
        cultivationSuggestion: cultivationSuggestionPromise,
        fieldCultivationColors: fieldCultivationColorsPromise,
        nitrogenBalance: nitrogenBalancePromise,
        organicMatterBalance: organicMatterBalancePromise,
      },
    }

    return data(dashboardData)
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export default function FieldDashboardRoute() {
  const dashboard = useLoaderData<typeof loader>()
  const registry = buildFieldDashboardRegistry({
    b_id: dashboard.b_id,
    b_id_farm: dashboard.b_id_farm,
    calendar: dashboard.calendar,
  })
  const { capture } = useAnalytics()

  useEffect(() => {
    capture("field_dashboard_viewed", {
      b_id_farm: dashboard.b_id_farm,
      b_id: dashboard.b_id,
      calendar: dashboard.calendar,
    })
  }, [dashboard.b_id_farm, dashboard.b_id, dashboard.calendar, capture])

  return (
    <div className="space-y-8 pb-8">
      {FIELD_DASHBOARD_SECTIONS.map((section) => {
        const tiles = registry.filter((tile) => tile.section === section.id)
        if (tiles.length === 0) return null

        return (
          <section
            key={section.id}
            className="space-y-4"
            aria-labelledby={section.showHeading !== false ? `${section.id}-heading` : undefined}
          >
            {section.showHeading !== false ? (
              <div id={`${section.id}-heading`}>
                <FieldDashboardSectionHeading title={section.title} />
              </div>
            ) : null}
            <div className={section.gridClassName}>
              {tiles.map((tile) => (
                <div key={tile.id} className={cn("min-w-0", tile.span)}>
                  <tile.Component dashboard={dashboard} tile={tile} />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
