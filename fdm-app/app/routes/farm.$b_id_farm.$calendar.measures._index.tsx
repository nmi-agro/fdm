import type { FeatureCollection, Geometry } from "geojson"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addMeasure,
  checkPermission,
  getCultivations,
  getCultivationsForFarm,
  getFarm,
  getFields,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  type PrincipalId,
  removeMeasure,
  type Timeframe,
  updateMeasure,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { ClipboardList, Sparkles } from "lucide-react"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Controller } from "react-hook-form"
import {
  type ActionFunctionArgs,
  Await,
  data,
  Link,
  type LoaderFunctionArgs,
  type MetaFunction,
  useFetcher,
  useLoaderData,
  useParams,
  useSearchParams,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Bln3HelpDialog } from "~/components/blocks/indicators/bln3-help-dialog"
import { AddMeasureDialog } from "~/components/blocks/measures/add-measure-dialog"
import { getColumns, type MeasureTableRow } from "~/components/blocks/measures/columns"
import { getFieldSummaryColumns } from "~/components/blocks/measures/field-summary-columns"
import { FieldSummaryTable } from "~/components/blocks/measures/field-summary-table"
import {
  type MeasureDateFormValues,
  MeasureDateSchema,
} from "~/components/blocks/measures/formschema"
import { MeasuresDataTable } from "~/components/blocks/measures/table"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import {
  getMeasureApplicabilityForFields,
  getIndicatorsForFarm,
  getFarmMeasureOpportunities,
  type FieldTopOpportunity,
} from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError, reportError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { isExcludedFromBln3 } from "~/lib/indicators"
import { INDICATORS } from "~/lib/indicators"

const MeasuresMap = lazy(() => import("@/app/components/blocks/measures/measures-atlas"))

/** A ranked measure × field recommendation for the farm-wide "Aanbevolen
 * maatregelen" card, derived from `getTopOpportunitiesForField` run per
 * field then flattened across the farm — deliberately cross-field and
 * cross-indicator, matching this route's "whole farm" framing. */
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

async function getFarmNextSteps({
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
  const { opportunities } = await getFarmMeasureOpportunities({
    principal_id,
    b_ids,
    b_year,
    timeframe,
    scoreByBid,
    activeMeasureIdsByField,
    measureNameById: new Map(catalogue.map((m) => [m.m_id, m.m_name])),
  })

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

/** Groups farm-wide measure × field recommendations by measure — one row per
 * measure with its fields as compact links, ranked by summed impact — instead
 * of one long row per field repeating the same measure name. */
function GroupedRecommendations({
  data,
  basePath,
  onOpenMeasure,
}: {
  data: FarmRecommendationsData
  basePath: string
  onOpenMeasure?: (m_id: string, fieldIds?: string[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const steps = data.steps

  const groups = useMemo(() => {
    const byMeasure = new Map<
      string,
      {
        m_name: string
        indicatorNames: string[]
        fields: { b_id: string; b_name: string | null; aggregateImpact: number }[]
        totalImpact: number
      }
    >()
    for (const step of steps) {
      const existing = byMeasure.get(step.m_id) ?? {
        m_name: step.m_name,
        indicatorNames: [],
        fields: [],
        totalImpact: 0,
      }
      if (step.indicatorName && !existing.indicatorNames.includes(step.indicatorName)) {
        existing.indicatorNames.push(step.indicatorName)
      }
      existing.fields.push({
        b_id: step.b_id,
        b_name: step.b_name,
        aggregateImpact: step.aggregateImpact,
      })
      existing.totalImpact += step.aggregateImpact
      byMeasure.set(step.m_id, existing)
    }
    return [...byMeasure.entries()]
      .map(([m_id, g]) => ({
        m_id,
        ...g,
        fields: g.fields.sort((a, b) => b.aggregateImpact - a.aggregateImpact),
      }))
      .sort((a, b) => b.totalImpact - a.totalImpact)
  }, [steps])

  const visible = expanded ? groups : groups.slice(0, 3)

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        <Sparkles className="h-4 w-4" />
        Aanbevolen maatregelen
      </p>
      <ul className="space-y-3">
        {visible.map((group, index) => (
          <li key={group.m_id} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-muted-foreground font-mono text-xs">
                  {group.m_id.replace("bln_", "")}
                </span>
                <span className="font-medium">{group.m_name}</span>
                {index === 0 && (
                  <span className="text-muted-foreground text-xs">
                    (grootste verwachte verbetering)
                  </span>
                )}
              </div>
              {onOpenMeasure && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenMeasure(
                      group.m_id,
                      group.fields.map((f) => f.b_id),
                    )
                  }
                  className="shrink-0 text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-200"
                >
                  + Toevoegen
                </button>
              )}
            </div>
            {group.indicatorNames.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Verbetert vooral: {group.indicatorNames.slice(0, 2).join(", ")}
              </p>
            )}
            <p className="mt-0.5 text-xs">
              {group.fields.slice(0, 4).map((field, i) => (
                <span key={field.b_id}>
                  {i > 0 && <span className="text-muted-foreground"> · </span>}
                  <Link
                    to={`${basePath}/${field.b_id}`}
                    className="text-foreground hover:text-primary transition-colors hover:underline"
                  >
                    {field.b_name ?? "Perceel"}
                  </Link>
                </span>
              ))}
              {group.fields.length > 4 && (
                <span className="text-muted-foreground"> +{group.fields.length - 4}</span>
              )}
            </p>
          </li>
        ))}
      </ul>
      {groups.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-muted-foreground hover:text-foreground mt-2 text-xs transition-colors"
        >
          {expanded ? "Toon minder" : `Toon alle ${groups.length} maatregelen`}
        </button>
      )}
    </div>
  )
}

export const meta: MetaFunction = () => {
  return [
    {
      title: `Maatregelen | Bedrijfsoverzicht | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Overzicht van bodembeheersmaatregelen per perceel voor het hele bedrijf.",
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    const [farm, fields, measuresMap, catalogue, farmWritePermission] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getMeasuresForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getMeasuresFromCatalogue(fdm),
      checkPermission(
        fdm,
        "farm",
        "write",
        b_id_farm,
        session.principal_id,
        "routes/farm.$b_id_farm.$calendar.measures._index",
        false,
      ),
    ])

    const calendarYear = Number(calendar)
    const b_year = Number.isFinite(calendarYear) ? calendarYear : new Date().getFullYear()
    const fieldIds = fields.map((f) => f.b_id)

    const [applicabilityByField, fieldCultivations] = await Promise.all([
      getMeasureApplicabilityForFields({
        principal_id: session.principal_id,
        b_ids: fieldIds,
        b_year,
        timeframe,
      }).catch((error) => {
        reportError(error, { page: "farm measures applicability" })
        return {}
      }),
      Promise.all(fields.map((f) => getCultivations(fdm, session.principal_id, f.b_id))),
    ])

    const fieldsWithCultivations = fields.map((f, i) => ({
      field: f,
      cultivations: fieldCultivations[i],
      mainCultivation: getMainCultivation(fieldCultivations[i], calendar) ?? null,
    }))

    // Exclude buffer strips, nature plots, and non-agricultural fields from measures recommendations
    const eligibleFieldsWithCultivations = fieldsWithCultivations.filter(
      ({ field, mainCultivation }) =>
        !isExcludedFromBln3({
          b_bufferstrip: field.b_bufferstrip,
          b_lu_croprotation: mainCultivation?.b_lu_croprotation,
          b_lu_catalogue: mainCultivation?.b_lu_catalogue,
        }),
    )

    // Lazy, batched farm-wide advice fetch for the "Aanbevolen
    // maatregelen" card — not awaited so it never blocks the rest of the page.
    const farmNextStepsPromise = getFarmNextSteps({
      principal_id: session.principal_id,
      b_id_farm,
      fields: eligibleFieldsWithCultivations.map(({ field }) => ({
        b_id: field.b_id,
        b_name: field.b_name ?? null,
      })),
      b_year,
      timeframe,
      measuresMap,
      catalogue,
    }).catch((error) => {
      reportError(error, { page: "farm measures recommendations" })
      return {
        steps: [],
        opportunitiesByField: {},
        topOpportunities: [],
        measureImpacts: {},
      }
    })
    const fieldList = eligibleFieldsWithCultivations.map(({ field, mainCultivation }) => ({
      b_id: field.b_id,
      b_name: field.b_name ?? null,
      b_area: field.b_area ?? null,
      mainCultivation: mainCultivation
        ? {
            b_lu_name: mainCultivation.b_lu_name ?? null,
            b_lu_croprotation: mainCultivation.b_lu_croprotation ?? null,
          }
        : null,
    }))

    // Build GeoJSON with measureCount per field for all fields
    const fieldsGeoJSON: FeatureCollection = {
      type: "FeatureCollection",
      features: fields.map((field) => ({
        type: "Feature" as const,
        properties: {
          b_id: field.b_id,
          b_name: field.b_name ?? null,
          b_area: field.b_area ?? null,
          b_bufferstrip: field.b_bufferstrip ?? false,
          measureCount: measuresMap.get(field.b_id)?.length ?? 0,
        },
        geometry: (field.b_geometry
          ? (() => {
              try {
                return simplify(field.b_geometry as Geometry, {
                  tolerance: 0.00001,
                  highQuality: true,
                })
              } catch {
                return null
              }
            })()
          : null) as Geometry,
      })),
    }

    // Build unique-measure rows grouped by m_id, including b_id_measure/dates
    const measuresByMId = new Map<string, MeasureTableRow>()
    for (const [b_id, measures] of measuresMap.entries()) {
      const fieldEntry_item = fields.find((f) => f.b_id === b_id)
      for (const m of measures) {
        const fieldEntry = {
          b_id,
          b_name: fieldEntry_item?.b_name ?? null,
          b_id_measure: m.b_id_measure,
          m_start: m.m_start,
          m_end: m.m_end,
        }
        const existing = measuresByMId.get(m.m_id)
        if (existing) {
          existing.fields.push(fieldEntry)
        } else {
          measuresByMId.set(m.m_id, {
            m_id: m.m_id,
            m_name: m.m_name,
            fields: [fieldEntry],
          })
        }
      }
    }
    const measureRows: MeasureTableRow[] = [...measuresByMId.values()].sort((a, b) =>
      a.m_name.localeCompare(b.m_name, "nl"),
    )

    // Compute summary stats from measuresMap for eligible fields
    const totalMeasures = [...measuresMap.values()].reduce(
      (sum, measures) => sum + measures.length,
      0,
    )
    const fieldsWithMeasures = eligibleFieldsWithCultivations.filter(
      ({ field }) => (measuresMap.get(field.b_id)?.length ?? 0) > 0,
    ).length
    const fieldsWithoutMeasures = eligibleFieldsWithCultivations.length - fieldsWithMeasures

    // Per-field summary for the table — only eligible fields (excluded fields like buffer strips and nature areas are not listed)
    const fieldSummaries = eligibleFieldsWithCultivations.map(({ field, mainCultivation }) => {
      const fieldMeasures = measuresMap.get(field.b_id) ?? []
      return {
        b_id: field.b_id,
        b_name: field.b_name ?? null,
        b_area: field.b_area ?? null,
        b_bufferstrip: field.b_bufferstrip ?? false,
        mainCultivations: mainCultivation
          ? [
              {
                b_lu_catalogue: mainCultivation.b_lu_catalogue,
                b_lu_name: mainCultivation.b_lu_name ?? null,
                b_lu_croprotation: mainCultivation.b_lu_croprotation ?? null,
              },
            ]
          : [],
        measures: fieldMeasures.map((m) => ({
          m_name: m.m_name,
        })),
      }
    })

    return {
      farmName: farm?.b_name_farm ?? "Bedrijf",
      farmWritePermission,
      fieldList,
      fieldsGeoJSON,
      measureRows,
      catalogue,
      mapStyle: getMapStyle("satellite"),
      fieldSummaries,
      applicabilityByField,
      stats: {
        totalFields: eligibleFieldsWithCultivations.length,
        totalMeasures,
        fieldsWithMeasures,
        fieldsWithoutMeasures,
      },
      asyncInsights: {
        farmNextSteps: farmNextStepsPromise,
      },
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    if (!b_id_farm) throw new Error("missing: b_id_farm")
    const calendar = getCalendar(params)
    const timeframe = getTimeframe(params)

    const session = await getSession(request)
    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "add") {
      const m_id = formData.get("m_id")
      const m_start_str = formData.get("m_start")
      const m_end_str = formData.get("m_end")
      const b_ids = formData.getAll("b_id") as string[]

      if (!m_id || typeof m_id !== "string") {
        return dataWithError(
          "missing: m_id",
          "Helaas, er is wat misgegaan. Probeer het later opnieuw.",
        )
      }
      if (!m_start_str || typeof m_start_str !== "string") {
        return dataWithError("missing: m_start", "Selecteer een startdatum.")
      }
      if (b_ids.length === 0) {
        return dataWithError("missing: b_ids", "Selecteer minimaal één perceel.")
      }

      const farmFields = await getFields(fdm, session.principal_id, b_id_farm, timeframe)
      const fieldMap = new Map(farmFields.map((f) => [f.b_id, f]))
      const cultivations = await getCultivationsForFarm(
        fdm,
        session.principal_id,
        b_id_farm,
        timeframe,
      )

      const eligibleBIds = b_ids.filter((b_id) => {
        const field = fieldMap.get(b_id)
        if (!field) return false
        const fieldCultivations = cultivations.get(b_id) ?? []
        const defaultCultivation = getMainCultivation(fieldCultivations, calendar)
        return !isExcludedFromBln3({
          b_bufferstrip: field.b_bufferstrip,
          b_lu_croprotation: defaultCultivation?.b_lu_croprotation,
          b_lu_catalogue: defaultCultivation?.b_lu_catalogue,
        })
      })

      if (eligibleBIds.length === 0) {
        return dataWithError(
          "forbidden: excluded fields",
          "Maatregelen kunnen niet worden toegevoegd aan bufferstroken of natuurpercelen.",
        )
      }

      const m_start = new Date(m_start_str)
      const m_end =
        m_end_str && typeof m_end_str === "string" && m_end_str !== ""
          ? new Date(m_end_str)
          : undefined

      await Promise.all(
        eligibleBIds.map((b_id) =>
          addMeasure(fdm, session.principal_id, b_id, m_id, m_start, m_end),
        ),
      )

      const count = eligibleBIds.length
      return dataWithSuccess(
        { result: "Maatregelen toegevoegd" },
        {
          message:
            count === 1
              ? "Maatregel toegevoegd voor 1 perceel."
              : `Maatregel toegevoegd voor ${count} percelen.`,
        },
      )
    }

    if (intent === "update") {
      const b_id_measures = formData.getAll("b_id_measure") as string[]
      const m_start_str = formData.get("m_start")
      const m_end_str = formData.get("m_end")

      if (b_id_measures.length === 0) {
        return dataWithError("missing: b_id_measures", "Helaas, er is wat misgegaan.")
      }

      const m_start =
        m_start_str && typeof m_start_str === "string" && m_start_str !== ""
          ? new Date(m_start_str)
          : undefined
      const m_end =
        m_end_str && typeof m_end_str === "string" && m_end_str !== ""
          ? new Date(m_end_str)
          : undefined

      await Promise.all(
        b_id_measures.map((id) => updateMeasure(fdm, session.principal_id, id, m_start, m_end)),
      )

      return dataWithSuccess(
        { result: "Maatregel bijgewerkt" },
        { message: "Maatregel is bijgewerkt." },
      )
    }

    if (intent === "delete") {
      const b_id_measures = formData.getAll("b_id_measure") as string[]
      if (b_id_measures.length === 0) {
        return dataWithError("missing: b_id_measures", "Helaas, er is wat misgegaan.")
      }
      await Promise.all(b_id_measures.map((id) => removeMeasure(fdm, session.principal_id, id)))
      return dataWithSuccess(
        { result: "Maatregel verwijderd" },
        { message: "Maatregel is verwijderd." },
      )
    }

    return dataWithError("unknown intent", "Onbekende actie.")
  } catch (error) {
    return handleActionError(error)
  }
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function MeasureEditDialog({
  row,
  closeMode = false,
  onClose,
  action = "?index",
}: {
  row: MeasureTableRow | null
  closeMode?: boolean
  onClose: () => void
  action?: string
}) {
  const fetcher = useFetcher()
  const [doorlopend, setDoorlopend] = useState(true)

  const form = useRemixForm<MeasureDateFormValues>({
    fetcher,
    resolver: zodResolver(MeasureDateSchema),
    defaultValues: { m_start: "", m_end: null },
    submitHandlers: {
      onValid: (data) => {
        const fd = new FormData()
        fd.append("intent", "update")
        for (const f of row?.fields ?? []) {
          fd.append("b_id_measure", f.b_id_measure)
        }
        fd.append("m_start", data.m_start)
        if (data.m_end) fd.append("m_end", data.m_end)
        else fd.append("m_end", "")
        void fetcher.submit(fd, { method: "post", action })
        onClose()
      },
    },
  })

  // Reset form when the row or mode changes
  const { reset } = form
  useEffect(() => {
    if (!row) return
    const firstField = row.fields[0]
    reset({
      m_start: firstField?.m_start ? new Date(firstField.m_start).toISOString() : "",
      m_end: firstField?.m_end ? new Date(firstField.m_end).toISOString() : null,
    })
    setDoorlopend(closeMode ? false : !firstField?.m_end)
  }, [row, closeMode, reset])

  return (
    <Dialog open={row !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{closeMode ? "Maatregel afsluiten" : "Maatregel bewerken"}</DialogTitle>
        </DialogHeader>
        {row && (
          <form onSubmit={form.handleSubmit}>
            <FieldGroup className="py-2">
              <p className="text-sm font-medium">{row.m_name}</p>
              {row.fields.length > 1 && (
                <p className="text-muted-foreground -mt-3 text-xs">
                  Geldt voor {row.fields.length} percelen. De datum wordt voor alle percelen
                  aangepast.
                </p>
              )}

              {!closeMode && (
                <Controller
                  control={form.control}
                  name="m_start"
                  render={({ field, fieldState }) => (
                    <DatePicker
                      label="Startdatum"
                      field={{
                        ...field,
                        value: field.value,
                      }}
                      fieldState={fieldState}
                      required
                    />
                  )}
                />
              )}

              {closeMode ? (
                <Controller
                  control={form.control}
                  name="m_end"
                  render={({ field, fieldState }) => (
                    <DatePicker
                      label="Einddatum"
                      field={{
                        ...field,
                        value: field.value,
                      }}
                      fieldState={fieldState}
                      required
                    />
                  )}
                />
              ) : (
                <Field>
                  <FieldLabel>Einddatum</FieldLabel>
                  <RadioGroup
                    value={doorlopend ? "doorlopend" : "einddatum"}
                    onValueChange={(v) => {
                      const isDoorlopend = v === "doorlopend"
                      setDoorlopend(isDoorlopend)
                      if (isDoorlopend) form.setValue("m_end", null)
                    }}
                    className="space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="doorlopend" id="edit-doorlopend" />
                      <Label htmlFor="edit-doorlopend" className="cursor-pointer font-normal">
                        Doorlopend
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="einddatum" id="edit-einddatum" />
                      <Label htmlFor="edit-einddatum" className="cursor-pointer font-normal">
                        Vaste einddatum
                      </Label>
                    </div>
                  </RadioGroup>
                  {!doorlopend && (
                    <Controller
                      control={form.control}
                      name="m_end"
                      render={({ field, fieldState }) => (
                        <DatePicker
                          label=""
                          field={{
                            ...field,
                            value: field.value,
                          }}
                          fieldState={fieldState}
                          required
                        />
                      )}
                    />
                  )}
                </Field>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuleren
                </Button>
                <Button type="submit">{closeMode ? "Afsluiten" : "Opslaan"}</Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Page component ────────────────────────────────────────────────────────────

export default function MeasuresFarmIndex() {
  const {
    fieldList,
    fieldsGeoJSON,
    measureRows,
    catalogue,
    mapStyle,
    stats,
    fieldSummaries,
    applicabilityByField,
    farmWritePermission,
    asyncInsights,
  } = useLoaderData<typeof loader>()
  const { b_id_farm, calendar } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const basePath = `/farm/${b_id_farm}/${calendar}/measures`

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [initialFieldIds, setInitialFieldIds] = useState<string[]>([])
  const [initialMeasureId, setInitialMeasureId] = useState<string | undefined>(undefined)
  const [recommendationsData, setRecommendationsData] = useState<FarmRecommendationsData | null>(
    null,
  )
  const [editingRow, setEditingRow] = useState<MeasureTableRow | null>(null)
  const [closingRow, setClosingRow] = useState<MeasureTableRow | null>(null)

  const calendarYearStart = calendar ? `${calendar}-01-01` : `${new Date().getFullYear()}-01-01`

  const handleFieldClick = useCallback(
    (b_id: string) => {
      if (!farmWritePermission) return
      setInitialFieldIds([b_id])
      setInitialMeasureId(undefined)
      setAddDialogOpen(true)
    },
    [farmWritePermission],
  )

  const handleAddClick = useCallback(() => {
    setInitialFieldIds([])
    setInitialMeasureId(undefined)
    setAddDialogOpen(true)
  }, [])

  const handleOpenMeasure = useCallback(
    (m_id: string, fieldIds?: string[]) => {
      if (!farmWritePermission) return
      setInitialMeasureId(m_id)
      if (fieldIds && fieldIds.length > 0) {
        setInitialFieldIds(fieldIds)
      } else {
        setInitialFieldIds([])
      }
      setAddDialogOpen(true)
    },
    [farmWritePermission],
  )

  const openMeasure = searchParams.get("openMeasure")
  useEffect(() => {
    if (!openMeasure) return
    setInitialMeasureId(openMeasure)
    setAddDialogOpen(true)
  }, [openMeasure])

  const columns = getColumns(
    (b_id) => `${basePath}/${b_id}`,
    "farm",
    setEditingRow,
    setClosingRow,
    `${basePath}?index`,
  )
  const fieldSummaryColumns = useMemo(() => getFieldSummaryColumns(), [])

  // Enrich fieldSummaries with the href for each field
  const fieldSummaryRows = useMemo(
    () =>
      fieldSummaries.map((f) => ({
        ...f,
        href: `${basePath}/${f.b_id}`,
      })),
    [fieldSummaries, basePath],
  )

  const emptyGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  }

  const tableOrEmpty =
    measureRows.length === 0 ? (
      <Empty className="border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>Geen maatregelen vastgelegd</EmptyTitle>
          <EmptyDescription>
            Maatregelen zijn bodembeheermaatregelen die je per perceel kunt vastleggen om de
            bodemkwaliteit te verbeteren. Klik op een perceel op de kaart of gebruik de knop om te
            beginnen.
          </EmptyDescription>
        </EmptyHeader>
        {farmWritePermission && (
          <EmptyContent>
            <Button onClick={handleAddClick}>Maatregel toevoegen</Button>
          </EmptyContent>
        )}
      </Empty>
    ) : (
      <MeasuresDataTable
        columns={columns}
        data={measureRows}
        onAddClick={handleAddClick}
        canModify={farmWritePermission}
      />
    )

  return (
    <>
      <FarmTitle
        title="Maatregelen"
        description="Overzicht van bodembeheersmaatregelen per perceel op dit bedrijf."
        rightNode={
          <div className="flex items-center gap-2">
            <Bln3HelpDialog />
          </div>
        }
      />

      <FarmContent>
        {/* One flex context with order utilities: on mobile the map moves to
            the end of the page (after the Percelen summary) as graceful
            degradation; on xl it sits beside the measures table again. */}
        <div className="flex flex-col gap-6 pb-10 xl:flex-row xl:flex-wrap xl:items-start">
          {/* Summary stats banner */}
          {stats.totalFields > 0 && (
            <div className="order-1 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="bg-card rounded-lg border px-4 py-3">
                <p className="text-muted-foreground text-xs">Actieve maatregelen</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.totalMeasures}</p>
              </div>
              <div className="bg-card rounded-lg border px-4 py-3">
                <p className="text-muted-foreground text-xs">Gewaspercelen met maatregel</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.fieldsWithMeasures}</p>
              </div>

              <div className="rounded-lg border px-4 py-3">
                <p className="text-muted-foreground text-xs">Gewaspercelen zonder maatregel</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">
                  {stats.fieldsWithoutMeasures}
                </p>
              </div>
            </div>
          )}

          <div className="order-2 min-w-0 flex-1 space-y-6">
            {tableOrEmpty}

            {/* Recommended measures, grouped by measure across the farm and
                lazily loaded so this potentially-slow batched NMI fetch never
                blocks the page. Placed below the table to use the empty space
                left of the (taller) map instead of a full-width banner. */}
            <Suspense
              fallback={
                <div className="bg-muted/20 flex items-center gap-2 rounded-lg border p-4 text-sm">
                  <Spinner className="text-muted-foreground h-4 w-4" />
                  <span className="text-muted-foreground">
                    Aanbevolen maatregelen worden berekend…
                  </span>
                </div>
              }
            >
              <Await resolve={asyncInsights.farmNextSteps} errorElement={null}>
                {(recData: FarmRecommendationsData) => {
                  if (recData && recData !== recommendationsData && !recommendationsData) {
                    setTimeout(() => setRecommendationsData(recData), 0)
                  }
                  return (
                    recData?.steps &&
                    recData.steps.length > 0 && (
                      <GroupedRecommendations
                        data={recData}
                        basePath={basePath}
                        onOpenMeasure={farmWritePermission ? handleOpenMeasure : undefined}
                      />
                    )
                  )
                }}
              </Await>
            </Suspense>
          </div>

          {/* Per-field summary table */}
          {fieldSummaryRows.length > 0 && (
            <div className="order-3 w-full xl:order-4">
              <Separator className="mb-6" />
              <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
                Percelen
              </h3>
              <FieldSummaryTable
                columns={fieldSummaryColumns}
                data={fieldSummaryRows}
                onAddMeasure={(selectedIds) => {
                  setInitialFieldIds(selectedIds)
                  setInitialMeasureId(undefined)
                  setAddDialogOpen(true)
                }}
                canModify={farmWritePermission}
              />
            </div>
          )}

          {/* Map — beside the table on xl, last on mobile (still available,
              just deprioritized), shorter on small screens. */}
          <div className="order-4 w-full overflow-hidden rounded-lg border xl:order-3 xl:w-96 xl:shrink-0">
            <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-lg" />}>
              <MeasuresMap
                fieldsGeoJSON={fieldsGeoJSON}
                selectedFieldGeoJSON={emptyGeoJSON}
                mapStyle={mapStyle}
                className="h-64 md:h-120"
                onFieldClick={handleFieldClick}
              />
            </Suspense>
          </div>
        </div>
      </FarmContent>

      <AddMeasureDialog
        open={addDialogOpen}
        onOpenChange={(next) => {
          setAddDialogOpen(next)
          if (!next) {
            setInitialMeasureId(undefined)
            if (searchParams.has("openMeasure")) {
              setSearchParams(
                (prev) => {
                  const nextParams = new URLSearchParams(prev)
                  nextParams.delete("openMeasure")
                  return nextParams
                },
                { replace: true },
              )
            }
          }
        }}
        catalogue={catalogue}
        activeMeasures={[]}
        applicabilityByField={applicabilityByField ?? undefined}
        fields={fieldList}
        initialFieldIds={initialFieldIds}
        topOpportunities={recommendationsData?.topOpportunities}
        opportunitiesByField={recommendationsData?.opportunitiesByField}
        measureImpacts={recommendationsData?.measureImpacts}
        initialMeasureId={initialMeasureId}
        calendarYearStart={calendarYearStart}
        harvestDate={null}
        action={`${basePath}?index`}
      />

      <MeasureEditDialog row={editingRow} onClose={() => setEditingRow(null)} />

      <MeasureEditDialog row={closingRow} closeMode onClose={() => setClosingRow(null)} />
    </>
  )
}
