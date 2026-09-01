import type { FeatureCollection, Geometry } from "geojson"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addMeasure,
  checkPermission,
  getCultivations,
  getField,
  getFields,
  getMeasures,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  removeMeasure,
  updateMeasure,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import { Controller } from "react-hook-form"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useParams,
  useSearchParams,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { Bln3BetaBanner } from "~/components/blocks/indicators/bln3-beta-banner"
import { AddMeasureDialog } from "~/components/blocks/measures/add-measure-dialog"
import {
  type MeasureDateFormValues,
  MeasureDateSchema,
} from "~/components/blocks/measures/formschema"
import { ImpactSummary } from "~/components/blocks/measures/impact-summary"
import { IndicatorAttention } from "~/components/blocks/measures/indicator-attention"
import { DatePicker } from "~/components/custom/date-picker-v2"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  getIndicatorsForField,
  getMeasureAdviceForField,
  getMeasureApplicabilityForField,
  getTopOpportunitiesForField,
} from "~/integrations/bln3.server"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { cn } from "~/lib/utils"

const MeasuresMap = lazy(() => import("~/components/blocks/measures/measures-atlas"))

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const fieldName = loaderData?.field?.b_name ?? "Perceel"
  return [
    {
      title: `${fieldName} | Maatregelen | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: `Bodembeheersmaatregelen voor ${fieldName}.`,
    },
  ]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const b_id = params.b_id
    const calendar = params.calendar

    if (!b_id_farm) {
      throw data("invalid: b_id_farm", {
        status: 400,
        statusText: "invalid: b_id_farm",
      })
    }
    if (!b_id) {
      throw data("invalid: b_id", {
        status: 400,
        statusText: "invalid: b_id",
      })
    }

    const session = await getSession(request)
    const timeframe = getTimeframe(params)
    const calendarYear = Number(calendar)

    const b_year = Number.isFinite(calendarYear) ? calendarYear : new Date().getFullYear()

    const [
      field,
      fields,
      measures,
      catalogue,
      farmMeasures,
      cultivations,
      bln3Result,
      applicabilityMap,
      advice,
      fieldWritePermission,
    ] = await Promise.all([
      getField(fdm, session.principal_id, b_id),
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getMeasures(fdm, session.principal_id, b_id, timeframe),
      getMeasuresFromCatalogue(fdm),
      getMeasuresForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivations(fdm, session.principal_id, b_id),
      getIndicatorsForField({
        principal_id: session.principal_id,
        b_id,
        timeframe,
      }).catch(() => null),
      getMeasureApplicabilityForField({
        principal_id: session.principal_id,
        b_id,
        b_year,
        timeframe,
      }).catch((err) => {
        console.error(
          `BLN3 applicability check failed for field ${b_id}:`,
          err instanceof Error ? err.message : String(err),
        )
        return null
      }),
      getMeasureAdviceForField({
        principal_id: session.principal_id,
        b_id,
        b_year,
        timeframe,
      }).catch((err) => {
        console.error(
          `BLN3 measure advice failed for field ${b_id}:`,
          err instanceof Error ? err.message : String(err),
        )
        return null
      }),
      checkPermission(
        fdm,
        "field",
        "write",
        b_id,
        session.principal_id,
        "routes/farm.$b_id_farm.$calendar.measures.$b_id",
        false,
      ),
    ])

    if (!field) {
      throw data("not found: b_id", {
        status: 404,
        statusText: "not found: b_id",
      })
    }

    // Derive harvest date from the active cultivation's b_lu_end
    const cal = getCalendar(params)
    const activeCultivation = getMainCultivation(cultivations, cal)
    const harvestDate = activeCultivation?.b_lu_end
      ? activeCultivation.b_lu_end.toISOString().split("T")[0]
      : null

    // Calendar year start as default measure start date
    const calendarYearStart = Number.isFinite(calendarYear)
      ? `${calendarYear}-01-01`
      : `${new Date().getFullYear()}-01-01`

    // Build GeoJSON for mini map (all farm fields coloured by measure count)
    const fieldsGeoJSON: FeatureCollection = {
      type: "FeatureCollection",
      features: fields.map((f) => ({
        type: "Feature" as const,
        properties: {
          b_id: f.b_id,
          b_name: f.b_name ?? null,
          measureCount: farmMeasures.get(f.b_id)?.length ?? 0,
        },
        geometry: simplify(f.b_geometry as Geometry, {
          tolerance: 0.00001,
          highQuality: true,
        }),
      })),
    }

    // GeoJSON for the selected (highlighted) field
    const selectedFeature = fieldsGeoJSON.features.find((f) => f.properties?.b_id === b_id)
    const selectedFieldGeoJSON: FeatureCollection = {
      type: "FeatureCollection",
      features: selectedFeature ? [selectedFeature] : [],
    }

    // Compute ranked measure recommendations for this field, cross-referenced
    // against current score, fresh applicability, and already-active measures.
    // `advice` is null when the NMI fetch failed — omit recommendations
    // entirely in that case rather than deriving them from empty data.
    const activeMeasureIds = new Set(measures.map((m) => m.m_id))
    const topOpportunities =
      advice && applicabilityMap
        ? getTopOpportunitiesForField({
            advice,
            score: bln3Result?.score ?? null,
            applicability: applicabilityMap,
            activeMeasureIds,
          })
        : undefined

    // Raw per-indicator impact per measure (all indicators, not only weak
    // ones) for the configure step of the add-measure dialog: "what will
    // this measure do?" for any measure, not just recommended ones.
    // Undefined when advice was unavailable — the dialog then hides the
    // impact section rather than implying zero impact.
    const measureImpacts:
      | Record<string, { indicator_id: string; measure_impact: number }[]>
      | undefined = advice
      ? (() => {
          const map: Record<string, { indicator_id: string; measure_impact: number }[]> = {}
          for (const entry of advice.indicator_advice) {
            for (const measure of entry.measures) {
              if (measure.measure_impact <= 0) continue
              ;(map[measure.m_id] ??= []).push({
                indicator_id: entry.indicator,
                measure_impact: measure.measure_impact,
              })
            }
          }
          for (const impacts of Object.values(map)) {
            impacts.sort((a, b) => b.measure_impact - a.measure_impact)
          }
          return map
        })()
      : undefined

    return {
      field,
      fieldWritePermission,
      measures,
      catalogue,
      fieldsGeoJSON,
      selectedFieldGeoJSON,
      mapStyle: getMapStyle("satellite"),
      harvestDate,
      calendarYearStart,
      fieldList: fields.map((f) => ({
        b_id: f.b_id,
        b_name: f.b_name ?? null,
      })),
      fieldScore: bln3Result?.score ?? null,
      applicabilityMap,
      topOpportunities,
      measureImpacts,
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id = params.b_id
    if (!b_id) throw new Error("missing: b_id")

    const session = await getSession(request)
    const formData = await request.formData()
    const intent = formData.get("intent")

    if (intent === "add") {
      const m_id = formData.get("m_id")
      const m_start_str = formData.get("m_start")
      const m_end_str = formData.get("m_end")

      if (!m_id || typeof m_id !== "string") {
        return dataWithError(
          "missing: m_id",
          "Helaas, er is wat misgegaan. Probeer het later opnieuw.",
        )
      }
      if (!m_start_str || typeof m_start_str !== "string") {
        return dataWithError("missing: m_start", "Selecteer een startdatum.")
      }

      const m_start = new Date(m_start_str)
      if (Number.isNaN(m_start.getTime())) {
        return dataWithError("invalid: m_start", "Selecteer een geldige startdatum.")
      }
      const m_end =
        m_end_str && typeof m_end_str === "string" && m_end_str !== ""
          ? new Date(m_end_str)
          : undefined
      if (m_end !== undefined && Number.isNaN(m_end.getTime())) {
        return dataWithError("invalid: m_end", "Selecteer een geldige einddatum.")
      }

      await addMeasure(fdm, session.principal_id, b_id, m_id, m_start, m_end)

      return dataWithSuccess(
        { result: "Maatregel toegevoegd" },
        { message: "Maatregel is toegevoegd." },
      )
    }

    if (intent === "update") {
      const b_id_measure = formData.get("b_id_measure")
      const m_start_str = formData.get("m_start")
      const m_end_str = formData.get("m_end")

      if (!b_id_measure || typeof b_id_measure !== "string") {
        return dataWithError("missing: b_id_measure", "Helaas, er is wat misgegaan.")
      }
      const m_start =
        m_start_str && typeof m_start_str === "string" && m_start_str !== ""
          ? new Date(m_start_str)
          : undefined
      if (m_start !== undefined && Number.isNaN(m_start.getTime())) {
        return dataWithError("invalid: m_start", "Selecteer een geldige startdatum.")
      }
      const m_end =
        m_end_str && typeof m_end_str === "string" && m_end_str !== ""
          ? new Date(m_end_str)
          : undefined
      if (m_end !== undefined && Number.isNaN(m_end.getTime())) {
        return dataWithError("invalid: m_end", "Selecteer een geldige einddatum.")
      }

      await updateMeasure(fdm, session.principal_id, b_id_measure, m_start, m_end)

      return dataWithSuccess(
        { result: "Maatregel bijgewerkt" },
        { message: "Maatregel is bijgewerkt." },
      )
    }

    if (intent === "delete") {
      const b_id_measure = formData.get("b_id_measure")
      if (!b_id_measure || typeof b_id_measure !== "string") {
        return dataWithError(
          "missing: b_id_measure",
          "Helaas, er is wat misgegaan. Probeer het later opnieuw.",
        )
      }

      await removeMeasure(fdm, session.principal_id, b_id_measure)

      return dataWithSuccess("Maatregel verwijderd", {
        message: "Maatregel is verwijderd",
      })
    }

    return dataWithError("unknown intent", "Onbekende actie.")
  } catch (error) {
    return handleActionError(error)
  }
}

function formatDateRange(m_start: string | Date | null, m_end: string | Date | null): string {
  const fmt = (d: string | Date | null) => {
    if (!d) return null
    const date = typeof d === "string" ? new Date(d) : d
    return format(date, "dd-MM-yyyy", { locale: nl })
  }
  const start = fmt(m_start)
  const end = fmt(m_end)
  if (!start && !end) return "Doorlopend"
  if (start && !end) return `${start} – Doorlopend`
  return `${start} – ${end}`
}

type EditingMeasure = {
  b_id_measure: string
  m_name: string
  m_start: Date | string | null
  m_end: Date | string | null
}

function toIso(d: Date | string | null | undefined): string {
  if (!d) return ""
  return typeof d === "string" ? d : d.toISOString()
}

function MeasureEditDialog({
  measure,
  closeMode = false,
  onClose,
  action = "",
}: {
  measure: EditingMeasure | null
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
        fd.append("b_id_measure", measure?.b_id_measure ?? "")
        fd.append("m_start", data.m_start)
        if (data.m_end) fd.append("m_end", data.m_end)
        else fd.append("m_end", "")
        void fetcher.submit(fd, {
          method: "post",
          action: action || undefined,
        })
        onClose()
      },
    },
  })

  // Reset form when measure or mode changes
  const { reset } = form
  useEffect(() => {
    if (!measure) return
    reset({
      m_start: toIso(measure.m_start),
      m_end: measure.m_end ? toIso(measure.m_end) : null,
    })
    setDoorlopend(closeMode ? false : !measure.m_end)
  }, [measure, closeMode, reset])

  return (
    <Dialog open={measure !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{closeMode ? "Maatregel afsluiten" : "Maatregel bewerken"}</DialogTitle>
        </DialogHeader>
        {measure && (
          <form onSubmit={form.handleSubmit}>
            <FieldGroup className="py-2">
              <p className="text-sm font-medium">{measure.m_name}</p>

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
                      else form.setValue("m_end", "")
                    }}
                    className="space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="doorlopend" id="field-edit-doorlopend" />
                      <Label htmlFor="field-edit-doorlopend" className="cursor-pointer font-normal">
                        Doorlopend
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="einddatum" id="field-edit-einddatum" />
                      <Label htmlFor="field-edit-einddatum" className="cursor-pointer font-normal">
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
                <Button type="submit" disabled={fetcher.state !== "idle"}>
                  {fetcher.state !== "idle" ? "Opslaan…" : closeMode ? "Afsluiten" : "Opslaan"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function MeasuresFieldDetail() {
  const {
    field,
    measures,
    catalogue,
    fieldsGeoJSON,
    selectedFieldGeoJSON,
    mapStyle,
    harvestDate,
    calendarYearStart,
    fieldScore,
    applicabilityMap,
    topOpportunities,
    measureImpacts,
    fieldWritePermission,
  } = useLoaderData<typeof loader>()
  const { b_id_farm, calendar, b_id } = useParams()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [focusIndicatorId, setFocusIndicatorId] = useState<string | undefined>(undefined)
  const [initialMeasureId, setInitialMeasureId] = useState<string | undefined>(undefined)
  const [editingMeasure, setEditingMeasure] = useState<EditingMeasure | null>(null)
  const [closingMeasure, setClosingMeasure] = useState<EditingMeasure | null>(null)

  const indicatorsHref = `/farm/${b_id_farm}/${calendar}/indicators/${b_id}`

  const handleOpenAddMeasure = (indicator_id?: string) => {
    setFocusIndicatorId(indicator_id)
    setInitialMeasureId(undefined)
    setDialogOpen(true)
  }

  // Deep-link support: opening this page with ?openMeasure=<m_id>&indicator=<id>
  // (e.g. from the Indicatoren page's "+ Toevoegen" quick action) auto-opens
  // the dialog pre-selected on that measure. The params are kept while the
  // dialog is open — clearing them immediately would lose the context on
  // refresh — and removed when the dialog closes.
  const openMeasure = searchParams.get("openMeasure")
  const indicator = searchParams.get("indicator") ?? undefined

  useEffect(() => {
    if (!openMeasure) return
    setInitialMeasureId(openMeasure)
    setFocusIndicatorId(indicator)
    setDialogOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMeasure, indicator])

  return (
    <div className="flex flex-col gap-6 p-4 md:px-8 md:pb-8">
      {/* Title + actions — the beta badge scopes the BLN3 content below, so
          it lives in the header as a title attribute, not as a separate slab. */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-2xl font-bold tracking-tight">{field.b_name ?? b_id}</h2>
            <Bln3BetaBanner />
          </div>
          <p className="text-muted-foreground mt-0.5">
            {measures.length === 0
              ? "Nog geen maatregelen vastgelegd"
              : `${measures.length} actieve maatregel${measures.length === 1 ? "" : "en"}`}
          </p>
        </div>
        {fieldWritePermission && (
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={() => handleOpenAddMeasure()} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Toevoegen
            </Button>
          </div>
        )}
      </div>

      {/* Indicator status cluster — the two blocks are peers ("what needs
          attention" vs. "what measures already achieve"): side by side on xl,
          stacked attention-first below. With no active measures the impact
          block is meaningless and hidden, and the cluster stays single-column. */}
      {fieldScore && fieldScore.indicators.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-3",
            measures.length > 0 && "xl:grid xl:grid-cols-2 xl:items-start",
          )}
        >
          <IndicatorAttention
            indicators={fieldScore.indicators}
            onAddMeasure={handleOpenAddMeasure}
            indicatorsHref={indicatorsHref}
            canAddMeasure={fieldWritePermission}
          />
          {/* No active measures → nothing to attribute influence to, so the
              block is hidden rather than showing a misleading empty state. */}
          {measures.length > 0 && (
            <ImpactSummary
              indicators={fieldScore.indicators}
              activeMeasures={measures.map((m) => ({ m_id: m.m_id, m_name: m.m_name }))}
              measureImpacts={measureImpacts}
            />
          )}
        </div>
      )}

      {/* List + map side-by-side on xl screens; the wider break above (mt-2 on
          top of gap-6) separates this content region from the status cluster. */}
      <div className="mt-2 flex flex-col items-start gap-6 xl:flex-row">
        {/* Active measures list */}
        <div className="min-w-0 flex-1">
          {measures.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border py-12 text-center">
              <p className="text-sm font-medium">Geen maatregelen actief</p>
              <p className="mt-1 text-xs">Voeg de eerste maatregel toe om te beginnen.</p>
              {fieldWritePermission && (
                <Button onClick={() => handleOpenAddMeasure()} size="sm" className="mt-4">
                  <Plus className="mr-1 h-4 w-4" />
                  Toevoegen
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y overflow-hidden rounded-lg border">
              {measures.map((m) => (
                <div
                  key={m.b_id_measure}
                  className="bg-background hover:bg-muted/30 flex items-start justify-between gap-4 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {m.m_id.replace("bln_", "")}
                      </span>
                      <span className="truncate text-sm font-medium">{m.m_name}</span>
                    </div>
                    {m.m_summary && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-relaxed">
                        {m.m_summary}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {formatDateRange(m.m_start, m.m_end)}
                      </span>
                      {!m.m_end && fieldWritePermission && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            setClosingMeasure({
                              b_id_measure: m.b_id_measure,
                              m_name: m.m_name,
                              m_start: m.m_start,
                              m_end: m.m_end,
                            })
                          }
                        >
                          Afsluiten
                        </Button>
                      )}
                    </div>
                  </div>
                  {fieldWritePermission && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground h-8 w-8"
                        title="Bewerken / afsluiten"
                        aria-label={`${m.m_name} bewerken of afsluiten`}
                        onClick={() =>
                          setEditingMeasure({
                            b_id_measure: m.b_id_measure,
                            m_name: m.m_name,
                            m_start: m.m_start,
                            m_end: m.m_end,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-8 w-8"
                            title="Verwijderen"
                            aria-label={`${m.m_name} verwijderen`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Maatregel verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Wil je &ldquo;
                              {m.m_name}
                              &rdquo; definitief verwijderen? Dit kan niet ongedaan worden gemaakt.
                              <br />
                              <br />
                              <span className="text-foreground font-medium">
                                Wil je de maatregel alleen beëindigen?
                              </span>{" "}
                              Gebruik dan de bewerkknop (
                              <Pencil className="mx-0.5 inline h-3.5 w-3.5" />) en stel een
                              einddatum in.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <form method="post">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="b_id_measure" value={m.b_id_measure} />
                              <AlertDialogAction
                                type="submit"
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
                                disabled={navigation.state !== "idle"}
                              >
                                Definitief verwijderen
                              </AlertDialogAction>
                            </form>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mini map — a field-switcher, subordinate to the list */}
        <div className="w-full overflow-hidden rounded-lg border xl:w-80 xl:shrink-0 ">
          <Suspense fallback={<div className="bg-muted h-64 animate-pulse rounded-lg" />}>
            <MeasuresMap
              fieldsGeoJSON={fieldsGeoJSON}
              selectedFieldGeoJSON={selectedFieldGeoJSON}
              initialFitGeoJSON={selectedFieldGeoJSON}
              mapStyle={mapStyle}
              className="h-64 md:h-100"
              onFieldClick={(b_id) => navigate(`/farm/${b_id_farm}/${calendar}/measures/${b_id}`)}
            />
          </Suspense>
        </div>
      </div>

      {/* Add Measure dialog */}
      <AddMeasureDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next)
          if (!next) {
            setFocusIndicatorId(undefined)
            setInitialMeasureId(undefined)
            if (searchParams.has("openMeasure")) {
              setSearchParams(
                (prev) => {
                  const nextParams = new URLSearchParams(prev)
                  nextParams.delete("openMeasure")
                  nextParams.delete("indicator")
                  return nextParams
                },
                { replace: true },
              )
            }
          }
        }}
        catalogue={catalogue}
        activeMeasures={measures}
        calendarYearStart={calendarYearStart}
        harvestDate={harvestDate}
        applicabilityMap={applicabilityMap ?? undefined}
        topOpportunities={topOpportunities}
        measureImpacts={measureImpacts}
        focusIndicatorId={focusIndicatorId}
        initialMeasureId={initialMeasureId}
      />

      {/* Edit Measure dialog */}
      <MeasureEditDialog measure={editingMeasure} onClose={() => setEditingMeasure(null)} />

      {/* Close Measure dialog */}
      <MeasureEditDialog
        measure={closingMeasure}
        closeMode
        onClose={() => setClosingMeasure(null)}
      />
    </div>
  )
}
