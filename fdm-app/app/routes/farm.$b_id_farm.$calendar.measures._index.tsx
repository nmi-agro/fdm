import type { FeatureCollection, Geometry } from "geojson"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  addMeasure,
  checkPermission,
  getCultivations,
  getFarm,
  getFields,
  getMeasuresForFarm,
  getMeasuresFromCatalogue,
  removeMeasure,
  updateMeasure,
} from "@nmi-agro/fdm-core"
import { simplify } from "@turf/simplify"
import { ClipboardList } from "lucide-react"
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { Controller } from "react-hook-form"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  useFetcher,
  useLoaderData,
  useParams,
} from "react-router"
import { useRemixForm } from "remix-hook-form"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
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
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getMainCultivation } from "~/lib/hoofdteelt.server"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

const MeasuresMap = lazy(() => import("@/app/components/blocks/measures/measures-atlas"))
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

    // Build field list for the dialog — enrich with cultivation + area
    const fieldCultivations = await Promise.all(
      fields.map((f) => getCultivations(fdm, session.principal_id, f.b_id)),
    )
    const fieldList = fields.map((f, i) => {
      const cultivations = fieldCultivations[i]
      const main = getMainCultivation(cultivations, calendar) ?? null
      return {
        b_id: f.b_id,
        b_name: f.b_name ?? null,
        b_area: f.b_area ?? null,
        mainCultivation: main
          ? {
              b_lu_name: main.b_lu_name ?? null,
              b_lu_croprotation: main.b_lu_croprotation ?? null,
            }
          : null,
      }
    })

    // Build GeoJSON with measureCount per field
    const fieldsGeoJSON: FeatureCollection = {
      type: "FeatureCollection",
      features: fields.map((f) => ({
        type: "Feature" as const,
        properties: {
          b_id: f.b_id,
          b_name: f.b_name ?? null,
          b_area: f.b_area ?? null,
          measureCount: measuresMap.get(f.b_id)?.length ?? 0,
        },
        geometry: (f.b_geometry
          ? (() => {
              try {
                return simplify(f.b_geometry as Geometry, {
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
      const field = fields.find((f) => f.b_id === b_id)
      for (const m of measures) {
        const fieldEntry = {
          b_id,
          b_name: field?.b_name ?? null,
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

    // Compute summary stats from measuresMap (no extra API calls needed)
    const totalMeasures = [...measuresMap.values()].reduce(
      (sum, measures) => sum + measures.length,
      0,
    )
    const fieldsWithMeasures = [...measuresMap.values()].filter((m) => m.length > 0).length
    const fieldsWithoutMeasures = fields.length - fieldsWithMeasures

    // Per-field summary for the table — derived from existing data
    const fieldSummaries = fields.map((f, i) => {
      const fieldMeasures = measuresMap.get(f.b_id) ?? []
      const cultivation = fieldCultivations[i]
      const main = getMainCultivation(cultivation, calendar) ?? null
      return {
        b_id: f.b_id,
        b_name: f.b_name ?? null,
        b_area: f.b_area ?? null,
        b_bufferstrip: f.b_bufferstrip ?? false,
        mainCultivations: main
          ? [
              {
                b_lu_catalogue: main.b_lu_catalogue,
                b_lu_name: main.b_lu_name ?? null,
                b_lu_croprotation: main.b_lu_croprotation ?? null,
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
      stats: {
        totalFields: fields.length,
        totalMeasures,
        fieldsWithMeasures,
        fieldsWithoutMeasures,
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

      const m_start = new Date(m_start_str)
      const m_end =
        m_end_str && typeof m_end_str === "string" && m_end_str !== ""
          ? new Date(m_end_str)
          : undefined

      await Promise.all(
        b_ids.map((b_id) => addMeasure(fdm, session.principal_id, b_id, m_id, m_start, m_end)),
      )

      const count = b_ids.length
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
    throw handleActionError(error)
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
    farmWritePermission,
  } = useLoaderData<typeof loader>()
  const { b_id_farm, calendar } = useParams()
  const basePath = `/farm/${b_id_farm}/${calendar}/measures`

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [initialFieldIds, setInitialFieldIds] = useState<string[]>([])
  const [editingRow, setEditingRow] = useState<MeasureTableRow | null>(null)
  const [closingRow, setClosingRow] = useState<MeasureTableRow | null>(null)

  const calendarYearStart = calendar ? `${calendar}-01-01` : `${new Date().getFullYear()}-01-01`

  const handleFieldClick = useCallback(
    (b_id: string) => {
      if (!farmWritePermission) return
      setInitialFieldIds([b_id])
      setAddDialogOpen(true)
    },
    [farmWritePermission],
  )

  const handleAddClick = useCallback(() => {
    setInitialFieldIds([])
    setAddDialogOpen(true)
  }, [])

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
      />

      <FarmContent>
        <div className="space-y-6 pb-10">
          {/* Summary stats banner */}
          {stats.totalFields > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="bg-card rounded-lg border px-4 py-3">
                <p className="text-muted-foreground text-xs">Actieve maatregelen</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.totalMeasures}</p>
              </div>
              <div className="bg-card rounded-lg border px-4 py-3">
                <p className="text-muted-foreground text-xs">Percelen met maatregel</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.fieldsWithMeasures}</p>
              </div>

              <div className="rounded-lg border px-4 py-3">
                <p className="text-muted-foreground text-xs">Percelen zonder maatregel</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">
                  {stats.fieldsWithoutMeasures}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-start gap-6 xl:flex-row">
            <div className="min-w-0 flex-1">{tableOrEmpty}</div>

            <div className="w-full overflow-hidden rounded-lg border xl:w-96 xl:shrink-0">
              <Suspense fallback={<div className="bg-muted h-80 animate-pulse rounded-lg" />}>
                <MeasuresMap
                  fieldsGeoJSON={fieldsGeoJSON}
                  selectedFieldGeoJSON={emptyGeoJSON}
                  mapStyle={mapStyle}
                  height="480px"
                  onFieldClick={handleFieldClick}
                />
              </Suspense>
            </div>
          </div>

          {/* Per-field summary table */}
          {fieldSummaryRows.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
                  Percelen
                </h3>
                <FieldSummaryTable
                  columns={fieldSummaryColumns}
                  data={fieldSummaryRows}
                  onAddMeasure={(selectedIds) => {
                    setInitialFieldIds(selectedIds)
                    setAddDialogOpen(true)
                  }}
                  canModify={farmWritePermission}
                />
              </div>
            </>
          )}
        </div>
      </FarmContent>

      <AddMeasureDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        catalogue={catalogue}
        activeMeasures={[]}
        fields={fieldList}
        initialFieldIds={initialFieldIds}
        calendarYearStart={calendarYearStart}
        harvestDate={null}
        action={`${basePath}?index`}
      />

      <MeasureEditDialog row={editingRow} onClose={() => setEditingRow(null)} />

      <MeasureEditDialog row={closingRow} closeMode onClose={() => setClosingRow(null)} />
    </>
  )
}
