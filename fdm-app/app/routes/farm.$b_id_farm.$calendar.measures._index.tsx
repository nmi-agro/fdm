import type { FeatureCollection, Geometry } from "geojson"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addMeasure,
  checkPermission,
  getCultivationsForFarm,
  getFarm,
  getFields,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  removeMeasure,
  updateMeasure,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { AlertTriangle, BookOpen, ClipboardList, RefreshCw, Sparkles } from "lucide-react"
import { lazy, Suspense, useCallback, useMemo, useState } from "react"
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
  useRevalidator,
  useSearchParams,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { dataWithError, dataWithSuccess, dataWithWarning } from "remix-toast"
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
import { MeasureDetailLink } from "~/components/blocks/measures/measure-detail-link"
import { MeasuresDataTable } from "~/components/blocks/measures/table"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button, buttonVariants } from "~/components/ui/button"
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
import { useStreamedRows } from "~/hooks/use-streamed-rows"
import {
  collectFarmMeasureInputs,
  getMeasureApplicabilityForFields,
} from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import { getNmiApiKey } from "~/integrations/nmi.server"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import {
  handleActionError,
  handleLoaderError,
  isMeasureOverlapError,
  reportError,
} from "~/lib/error"
import { type FarmRecommendationsData, getFarmNextSteps } from "~/lib/farm-measures.server"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { isExcludedFromBln3 } from "~/lib/indicators"
import { getMeasureCode, getMeasuresCataloguePath } from "~/lib/measures-catalogue"

const MeasuresMap = lazy(() => import("@/app/components/blocks/measures/measures-atlas"))

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
                <span className="text-muted-foreground text-xs tabular-nums">
                  {getMeasureCode(group.m_id)}
                </span>
                <span className="font-medium">{group.m_name}</span>
                <MeasureDetailLink
                  m_id={group.m_id}
                  m_name={group.m_name}
                  icon="external"
                  className="self-center"
                />
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
                    className="text-muted-foreground hover:text-foreground transition-colors hover:underline"
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

/**
 * Shown in place of "Aanbevolen maatregelen" when the advice could not be loaded for any field,
 * so the missing card does not read as "nothing to recommend". "Opnieuw proberen" reruns the
 * loader, like the status notice in the measures catalogue.
 */
function RecommendationsUnavailable() {
  const revalidator = useRevalidator()
  const isRetrying = revalidator.state === "loading"
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Aanbevolen maatregelen niet beschikbaar</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          De aanbevelingen konden niet worden geladen. Een maatregel zonder aanbeveling is dus niet
          per se ongeschikt.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 self-start sm:self-auto"
          disabled={isRetrying}
          onClick={() => {
            void revalidator.revalidate()
          }}
        >
          {isRetrying ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          <span>Opnieuw proberen</span>
        </Button>
      </AlertDescription>
    </Alert>
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

    // The measure inputs serve the applicability (for the add dialog) and the recommendations.
    // Both may call the NMI API, so they are streamed and never block the page.
    const measureInputs = collectFarmMeasureInputs({
      principal_id: session.principal_id,
      b_id_farm,
      b_ids: fieldIds,
      b_year,
      timeframe,
    })
    // `reportFailures` maps a failed field to `null`, so the recommendations request it again
    // instead of reading the failure as "no applicable measures"
    const applicabilityByField = measureInputs
      .then((inputs) => getMeasureApplicabilityForFields(inputs, { reportFailures: true }))
      .catch((error) => {
        reportError(error, { page: "farm measures applicability" })
        return {}
      })

    // All cultivations of each field, not only those in the calendar year
    const cultivationsByField = await getCultivationsForFarm(fdm, session.principal_id, b_id_farm)

    const fieldsWithCultivations = fields.map((f) => {
      const cultivations = cultivationsByField.get(f.b_id) ?? []
      return {
        field: f,
        cultivations,
        mainCultivation: getMainCultivation(cultivations, calendar) ?? null,
      }
    })

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
      measureInputs,
      applicabilityByField,
    }).catch((error) => {
      reportError(error, { page: "farm measures recommendations" })
      return {
        steps: [],
        opportunitiesByField: {},
        topOpportunities: [],
        measureImpacts: {},
        adviceAvailable: false,
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
      // Without an NMI API key there are no recommendations to load, so no failure to report
      nmiConfigured: Boolean(getNmiApiKey()),
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

      // All fields in one transaction. A field that already has this measure in the period is
      // skipped; any other error rolls back every field. The overlap check of fdm-core throws
      // before it writes, so the transaction stays usable after a skipped field.
      let count = 0
      await fdm.transaction(async (tx) => {
        for (const b_id of eligibleBIds) {
          try {
            await addMeasure(tx, session.principal_id, b_id, m_id, m_start, m_end)
            count++
          } catch (error) {
            if (!isMeasureOverlapError(error)) throw error
          }
        }
      })

      const skipped = eligibleBIds.length - count
      const fieldsLabel = (n: number) => (n === 1 ? "1 perceel" : `${n} percelen`)

      if (count === 0) {
        return dataWithWarning(
          { result: "Geen maatregelen toegevoegd" },
          skipped === 1
            ? "Deze maatregel loopt al op dit perceel in (een deel van) deze periode."
            : `Deze maatregel loopt al op alle ${skipped} percelen in (een deel van) deze periode.`,
        )
      }

      const added = `Maatregel toegevoegd voor ${fieldsLabel(count)}.`
      if (skipped > 0) {
        return dataWithWarning(
          { result: "Maatregelen deels toegevoegd" },
          `${added} Overgeslagen: ${fieldsLabel(skipped)} waar deze maatregel al loopt in (een deel van) deze periode.`,
        )
      }

      return dataWithSuccess({ result: "Maatregelen toegevoegd" }, { message: added })
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

      // All measures in one transaction: either every change is saved, or none is
      await fdm.transaction(async (tx) => {
        for (const id of b_id_measures) {
          await updateMeasure(tx, session.principal_id, id, m_start, m_end)
        }
      })

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
      // All measures in one transaction: either every measure is removed, or none is
      await fdm.transaction(async (tx) => {
        for (const id of b_id_measures) {
          await removeMeasure(tx, session.principal_id, id)
        }
      })
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
  return (
    <Dialog open={row !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{closeMode ? "Maatregel afsluiten" : "Maatregel bewerken"}</DialogTitle>
        </DialogHeader>
        {row && (
          // Remount on row/mode change instead of resetting in an effect.
          <MeasureEditForm
            key={`${row.m_id}-${closeMode}`}
            row={row}
            closeMode={closeMode}
            onClose={onClose}
            action={action}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MeasureEditForm({
  row,
  closeMode,
  onClose,
  action,
}: {
  row: MeasureTableRow
  closeMode: boolean
  onClose: () => void
  action: string
}) {
  const fetcher = useFetcher()
  const firstField = row.fields[0]
  const [doorlopend, setDoorlopend] = useState(closeMode ? false : !firstField?.m_end)

  const form = useRemixForm<MeasureDateFormValues>({
    fetcher,
    resolver: zodResolver(MeasureDateSchema),
    defaultValues: {
      m_start: firstField?.m_start ? new Date(firstField.m_start).toISOString() : "",
      m_end: firstField?.m_end ? new Date(firstField.m_end).toISOString() : null,
    },
    submitHandlers: {
      onValid: (data) => {
        const fd = new FormData()
        fd.append("intent", "update")
        for (const f of row.fields) {
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

  return (
    <form onSubmit={form.handleSubmit}>
      <FieldGroup className="py-2">
        <p className="text-sm font-medium">{row.m_name}</p>
        {row.fields.length > 1 && (
          <p className="text-muted-foreground -mt-3 text-xs">
            Geldt voor {row.fields.length} percelen. De datum wordt voor alle percelen aangepast.
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
    nmiConfigured,
    asyncInsights,
  } = useLoaderData<typeof loader>()
  // The applicability is streamed; until it arrives the add dialog waits with saving
  const applicabilityPromises = useMemo(() => [applicabilityByField], [applicabilityByField])
  const streamedApplicability = useStreamedRows(applicabilityPromises)
  const applicability = streamedApplicability.rows[0]
  const { b_id_farm, calendar } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const basePath = `/farm/${b_id_farm}/${calendar}/measures`

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [initialFieldIds, setInitialFieldIds] = useState<string[]>([])
  const [initialMeasureId, setInitialMeasureId] = useState<string | undefined>(undefined)
  // The recommendations for the add dialog, from the streamed farm next steps
  const nextStepsPromises = useMemo(
    () => [asyncInsights.farmNextSteps],
    [asyncInsights.farmNextSteps],
  )
  const recommendationsData = useStreamedRows(nextStepsPromises).rows[0] ?? null
  const [editingRow, setEditingRow] = useState<MeasureTableRow | null>(null)
  const [closingRow, setClosingRow] = useState<MeasureTableRow | null>(null)

  const calendarYearStart = `${calendar}-01-01`

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
  // The URL is the source of truth for a deep-linked measure: no effect needed to open it.
  const measureDialogOpen = addDialogOpen || !!openMeasure
  const measureDialogMeasureId = openMeasure ?? initialMeasureId
  // A deep link can also preselect fields (`?fields=a,b`), e.g. the fields on which the
  // catalogue recommends the measure. Unknown or ineligible IDs are ignored.
  const linkedFieldIds = useMemo(() => {
    const ids = searchParams.get("fields")?.split(",") ?? []
    const known = new Set(fieldList.map((field) => field.b_id))
    return ids.filter((id) => known.has(id))
  }, [searchParams, fieldList])
  const measureDialogFieldIds = openMeasure ? linkedFieldIds : initialFieldIds

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
            Maatregelen zijn bodembeheermaatregelen die u per perceel kunt vastleggen om de
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
        help="maatregelen"
        title="Maatregelen"
        description="Overzicht van bodembeheersmaatregelen per perceel op dit bedrijf."
        rightNode={
          // Help stays quiet; the catalogue is a destination, so it gets a real button
          <div className="flex flex-wrap items-center gap-2">
            <Bln3HelpDialog />
            {b_id_farm && calendar ? (
              <Link
                to={getMeasuresCataloguePath(b_id_farm, calendar)}
                className={buttonVariants({
                  variant: "outline",
                  className: "gap-1.5 pointer-coarse:h-11",
                })}
                data-slot="button"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>Maatregelencatalogus</span>
              </Link>
            ) : null}
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
                  // No advice for any eligible field: say so instead of hiding the section,
                  // which would read as "nothing to recommend"
                  // Without an NMI API key the section stays hidden, as retrying cannot help
                  if (
                    recData &&
                    !recData.adviceAvailable &&
                    fieldList.length > 0 &&
                    nmiConfigured
                  ) {
                    return <RecommendationsUnavailable />
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
        open={measureDialogOpen}
        onOpenChange={(next) => {
          setAddDialogOpen(next)
          if (!next) {
            setInitialMeasureId(undefined)
            if (searchParams.has("openMeasure")) {
              setSearchParams(
                (prev) => {
                  const nextParams = new URLSearchParams(prev)
                  nextParams.delete("openMeasure")
                  nextParams.delete("fields")
                  return nextParams
                },
                { replace: true },
              )
            }
          }
        }}
        catalogue={catalogue}
        activeMeasures={[]}
        applicabilityByField={applicability}
        applicabilityLoading={!streamedApplicability.complete}
        fields={fieldList}
        initialFieldIds={measureDialogFieldIds}
        topOpportunities={recommendationsData?.topOpportunities}
        opportunitiesByField={recommendationsData?.opportunitiesByField}
        measureImpacts={recommendationsData?.measureImpacts}
        initialMeasureId={measureDialogMeasureId}
        calendarYearStart={calendarYearStart}
        harvestDate={null}
        action={`${basePath}?index`}
      />

      <MeasureEditDialog row={editingRow} onClose={() => setEditingRow(null)} />

      <MeasureEditDialog row={closingRow} closeMode onClose={() => setClosingRow(null)} />
    </>
  )
}
