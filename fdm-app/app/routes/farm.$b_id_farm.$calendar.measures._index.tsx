import {
    getFarm,
    getFields,
    getCultivations,
    getMeasuresForFarm,
    getMeasuresFromCatalogue,
    addMeasure,
    removeMeasure,
    updateMeasure,
} from "@nmi-agro/fdm-core"
import { zodResolver } from "@hookform/resolvers/zod"
import { simplify } from "@turf/simplify"
import type { FeatureCollection, Geometry } from "geojson"
import { ClipboardList } from "lucide-react"
import { lazy, Suspense, useCallback, useEffect, useState } from "react"
import { Controller } from "react-hook-form"
import {
    data,
    type ActionFunctionArgs,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useParams,
    useFetcher,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { useRemixForm } from "remix-hook-form"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { AddMeasureDialog } from "~/components/blocks/measures/add-measure-dialog"
import {
    getColumns,
    type MeasureTableRow,
} from "~/components/blocks/measures/columns"
import { MeasureDateSchema, type MeasureDateFormValues } from "~/components/blocks/measures/formschema"
import { MeasuresDataTable } from "~/components/blocks/measures/table"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "~/components/ui/empty"
import { Label } from "~/components/ui/label"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"

const MeasuresMap = lazy(
    () => import("@/app/components/blocks/measures/measures-atlas"),
)
export const meta: MetaFunction = () => {
    return [
        {
            title: `Maatregelen | Bedrijfsoverzicht | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Overzicht van bodembeheersmaatregelen per perceel voor het hele bedrijf.",
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

        const [farm, fields, measuresMap, catalogue] = await Promise.all([
            getFarm(fdm, session.principal_id, b_id_farm),
            getFields(fdm, session.principal_id, b_id_farm, timeframe),
            getMeasuresForFarm(fdm, session.principal_id, b_id_farm, timeframe),
            getMeasuresFromCatalogue(fdm),
        ])

        // Build field list for the dialog — enrich with cultivation + area
        const fieldCultivations = await Promise.all(
            fields.map((f) =>
                getCultivations(fdm, session.principal_id, f.b_id),
            ),
        )
        const fieldList = fields.map((f, i) => {
            const cultivations = fieldCultivations[i]
            const main =
                getDefaultCultivation(cultivations, calendar) ??
                cultivations[0] ??
                null
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
                geometry: simplify(f.b_geometry as Geometry, {
                    tolerance: 0.00001,
                    highQuality: true,
                }),
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
        const measureRows: MeasureTableRow[] = [...measuresByMId.values()].sort(
            (a, b) => a.m_name.localeCompare(b.m_name, "nl"),
        )

        return {
            farmName: farm?.b_name_farm ?? "Bedrijf",
            fieldList,
            fieldsGeoJSON,
            measureRows,
            catalogue,
            mapStyle: getMapStyle("satellite"),
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
                return dataWithError(
                    "missing: m_start",
                    "Selecteer een startdatum.",
                )
            }
            if (b_ids.length === 0) {
                return dataWithError(
                    "missing: b_ids",
                    "Selecteer minimaal één perceel.",
                )
            }

            const m_start = new Date(m_start_str)
            const m_end =
                m_end_str && typeof m_end_str === "string" && m_end_str !== ""
                    ? new Date(m_end_str)
                    : undefined

            await Promise.all(
                b_ids.map((b_id) =>
                    addMeasure(
                        fdm,
                        session.principal_id,
                        b_id,
                        m_id,
                        m_start,
                        m_end,
                    ),
                ),
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
                return dataWithError(
                    "missing: b_id_measures",
                    "Helaas, er is wat misgegaan.",
                )
            }

            const m_start =
                m_start_str &&
                typeof m_start_str === "string" &&
                m_start_str !== ""
                    ? new Date(m_start_str)
                    : undefined
            const m_end =
                m_end_str && typeof m_end_str === "string" && m_end_str !== ""
                    ? new Date(m_end_str)
                    : undefined

            await Promise.all(
                b_id_measures.map((id) =>
                    updateMeasure(
                        fdm,
                        session.principal_id,
                        id,
                        m_start,
                        m_end,
                    ),
                ),
            )

            return dataWithSuccess(
                { result: "Maatregel bijgewerkt" },
                { message: "Maatregel is bijgewerkt." },
            )
        }

        if (intent === "delete") {
            const b_id_measures = formData.getAll("b_id_measure") as string[]
            if (b_id_measures.length === 0) {
                return dataWithError(
                    "missing: b_id_measures",
                    "Helaas, er is wat misgegaan.",
                )
            }
            await Promise.all(
                b_id_measures.map((id) =>
                    removeMeasure(fdm, session.principal_id, id),
                ),
            )
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
                fetcher.submit(fd, { method: "post", action })
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
            m_start: firstField?.m_start
                ? new Date(firstField.m_start).toISOString()
                : "",
            m_end: firstField?.m_end
                ? new Date(firstField.m_end).toISOString()
                : null,
        })
        setDoorlopend(closeMode ? false : !firstField?.m_end)
    }, [row?.m_id, closeMode, reset])

    return (
        <Dialog open={row !== null} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        {closeMode
                            ? "Maatregel afsluiten"
                            : "Maatregel bewerken"}
                    </DialogTitle>
                </DialogHeader>
                {row && (
                    <form onSubmit={form.handleSubmit}>
                        <FieldGroup className="py-2">
                            <p className="text-sm font-medium">{row.m_name}</p>
                            {row.fields.length > 1 && (
                                <p className="text-xs text-muted-foreground -mt-3">
                                    Geldt voor {row.fields.length} percelen. De
                                    datum wordt voor alle percelen aangepast.
                                </p>
                            )}

                            {!closeMode && (
                                <Controller
                                    control={form.control}
                                    name="m_start"
                                    render={({ field, fieldState }) => (
                                        <DatePicker
                                            label="Startdatum"
                                            field={{ ...field, value: field.value }}
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
                                            field={{ ...field, value: field.value }}
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
                                            <Label htmlFor="edit-doorlopend" className="font-normal cursor-pointer">
                                                Doorlopend
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="einddatum" id="edit-einddatum" />
                                            <Label htmlFor="edit-einddatum" className="font-normal cursor-pointer">
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
                                                    field={{ ...field, value: field.value }}
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
                                <Button type="submit">
                                    {closeMode ? "Afsluiten" : "Opslaan"}
                                </Button>
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
    const { fieldList, fieldsGeoJSON, measureRows, catalogue, mapStyle } =
        useLoaderData<typeof loader>()
    const { b_id_farm, calendar } = useParams()
    const basePath = `/farm/${b_id_farm}/${calendar}/measures`

    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [initialFieldIds, setInitialFieldIds] = useState<string[]>([])
    const [editingRow, setEditingRow] = useState<MeasureTableRow | null>(null)
    const [closingRow, setClosingRow] = useState<MeasureTableRow | null>(null)

    const calendarYearStart = calendar
        ? `${calendar}-01-01`
        : `${new Date().getFullYear()}-01-01`

    const handleFieldClick = useCallback((b_id: string) => {
        setInitialFieldIds([b_id])
        setAddDialogOpen(true)
    }, [])

    const handleAddClick = useCallback(() => {
        setInitialFieldIds([])
        setAddDialogOpen(true)
    }, [])

    const columns = getColumns(basePath, setEditingRow, setClosingRow)

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
                        Maatregelen zijn bodembeheermaatregelen die je per
                        perceel kunt vastleggen om de bodemkwaliteit te
                        verbeteren. Klik op een perceel op de kaart of gebruik
                        de knop om te beginnen.
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button onClick={handleAddClick}>
                        Maatregel toevoegen
                    </Button>
                </EmptyContent>
            </Empty>
        ) : (
            <MeasuresDataTable
                columns={columns}
                data={measureRows}
                onAddClick={handleAddClick}
            />
        )

    return (
        <>
            <FarmTitle
                title="Maatregelen"
                description="Overzicht van bodembeheersmaatregelen per perceel op dit bedrijf."
            />

            <div className="p-4 md:px-8 md:pb-8">
                <div className="flex flex-col xl:flex-row gap-6 items-start">
                    <div className="flex-1 min-w-0">{tableOrEmpty}</div>

                    <div className="xl:w-96 xl:shrink-0 w-full rounded-lg overflow-hidden border">
                        <Suspense
                            fallback={
                                <div className="h-80 bg-muted animate-pulse rounded-lg" />
                            }
                        >
                            <MeasuresMap
                                fieldsGeoJSON={fieldsGeoJSON}
                                selectedFieldGeoJSON={emptyGeoJSON}
                                mapStyle={mapStyle}
                                basePath={basePath}
                                height="480px"
                                onFieldClick={handleFieldClick}
                            />
                        </Suspense>
                    </div>
                </div>
            </div>

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

            <MeasureEditDialog
                row={editingRow}
                onClose={() => setEditingRow(null)}
            />

            <MeasureEditDialog
                row={closingRow}
                closeMode
                onClose={() => setClosingRow(null)}
            />
        </>
    )
}
