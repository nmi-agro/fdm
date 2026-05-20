import {
    addMeasure,
    getCultivations,
    getField,
    getFields,
    getMeasures,
    getMeasuresForFarm,
    getMeasuresFromCatalogue,
    removeMeasure,
    updateMeasure,
} from "@nmi-agro/fdm-core"
import { zodResolver } from "@hookform/resolvers/zod"
import { simplify } from "@turf/simplify"
import type { FeatureCollection, Geometry } from "geojson"
import { lazy, Suspense, useEffect, useState } from "react"
import { Controller } from "react-hook-form"
import {
    type ActionFunctionArgs,
    data,
    type LoaderFunctionArgs,
    type MetaFunction,
    useLoaderData,
    useNavigation,
    useParams,
    useFetcher,
} from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import { useRemixForm } from "remix-hook-form"
import { AddMeasureDialog } from "~/components/blocks/measures/add-measure-dialog"
import { MeasureDateSchema, type MeasureDateFormValues } from "~/components/blocks/measures/formschema"
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { getMapStyle } from "~/integrations/map"
import { getSession } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { Trash2, Plus, Pencil } from "lucide-react"

const MeasuresMap = lazy(
    () => import("@/app/components/blocks/measures/measures-atlas"),
)

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const fieldName = data?.field?.b_name ?? "Perceel"
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

        const [field, fields, measures, catalogue, farmMeasures, cultivations] =
            await Promise.all([
                getField(fdm, session.principal_id, b_id),
                getFields(fdm, session.principal_id, b_id_farm, timeframe),
                getMeasures(fdm, session.principal_id, b_id, timeframe),
                getMeasuresFromCatalogue(fdm),
                getMeasuresForFarm(
                    fdm,
                    session.principal_id,
                    b_id_farm,
                    timeframe,
                ),
                getCultivations(fdm, session.principal_id, b_id),
            ])

        if (!field) {
            throw data("not found: b_id", {
                status: 404,
                statusText: "not found: b_id",
            })
        }

        // Derive harvest date from the active cultivation's b_lu_end
        const cal = getCalendar(params)
        const activeCultivation = getDefaultCultivation(cultivations, cal)
        const harvestDate = activeCultivation?.b_lu_end
            ? activeCultivation.b_lu_end.toISOString().split("T")[0]
            : null

        // Calendar year start as default measure start date
        const calendarYearStart = Number.isFinite(calendarYear)
            ? `${calendarYear}-01-01`
            : new Date().getFullYear() + "-01-01"

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
        const selectedFeature = fieldsGeoJSON.features.find(
            (f) => f.properties?.b_id === b_id,
        )
        const selectedFieldGeoJSON: FeatureCollection = {
            type: "FeatureCollection",
            features: selectedFeature ? [selectedFeature] : [],
        }

        return {
            field,
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
                return dataWithError(
                    "missing: m_start",
                    "Selecteer een startdatum.",
                )
            }

            const m_start = new Date(m_start_str)
            const m_end =
                m_end_str && typeof m_end_str === "string" && m_end_str !== ""
                    ? new Date(m_end_str)
                    : undefined

            await addMeasure(
                fdm,
                session.principal_id,
                b_id,
                m_id,
                m_start,
                m_end,
            )

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
                return dataWithError(
                    "missing: b_id_measure",
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

            await updateMeasure(
                fdm,
                session.principal_id,
                b_id_measure,
                m_start,
                m_end,
            )

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
        throw handleActionError(error)
    }
}

function formatDateRange(
    m_start: string | Date | null,
    m_end: string | Date | null,
): string {
    const fmt = (d: string | Date | null) => {
        if (!d) return null
        const date = typeof d === "string" ? new Date(d) : d
        return date.toLocaleDateString("nl-NL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        })
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
                fd.append("b_id_measure", measure!.b_id_measure)
                fd.append("m_start", data.m_start)
                if (data.m_end) fd.append("m_end", data.m_end)
                else fd.append("m_end", "")
                fetcher.submit(fd, { method: "post", action: action || undefined })
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
    }, [measure?.b_id_measure, closeMode, reset])

    return (
        <Dialog open={measure !== null} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        {closeMode ? "Maatregel afsluiten" : "Maatregel bewerken"}
                    </DialogTitle>
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
                                            <RadioGroupItem value="doorlopend" id="field-edit-doorlopend" />
                                            <Label htmlFor="field-edit-doorlopend" className="font-normal cursor-pointer">
                                                Doorlopend
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <RadioGroupItem value="einddatum" id="field-edit-einddatum" />
                                            <Label htmlFor="field-edit-einddatum" className="font-normal cursor-pointer">
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
    } = useLoaderData<typeof loader>()
    const { b_id_farm, calendar, b_id } = useParams()
    const navigation = useNavigation()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingMeasure, setEditingMeasure] = useState<EditingMeasure | null>(
        null,
    )
    const [closingMeasure, setClosingMeasure] = useState<EditingMeasure | null>(
        null,
    )

    const basePath = `/farm/${b_id_farm}/${calendar}/measures`

    return (
        <div className="flex flex-col gap-6 p-4 md:px-8 md:pb-8">
            {/* Title + Add button */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {field.b_name ?? b_id}
                    </h2>
                    <p className="text-muted-foreground mt-0.5">
                        {measures.length === 0
                            ? "Nog geen maatregelen vastgelegd"
                            : `${measures.length} actieve maatregel${measures.length === 1 ? "" : "en"}`}
                    </p>
                </div>
                <Button
                    onClick={() => setDialogOpen(true)}
                    size="sm"
                    className="shrink-0"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    Toevoegen
                </Button>
            </div>

            {/* List + map side-by-side on xl screens */}
            <div className="flex flex-col xl:flex-row gap-6 items-start">
                {/* Active measures list */}
                <div className="flex-1 min-w-0">
                    {measures.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12 border rounded-lg">
                            <p className="text-sm font-medium">
                                Geen maatregelen actief
                            </p>
                            <p className="text-xs mt-1">
                                Voeg maatregelen toe via de knop hierboven.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y border rounded-lg overflow-hidden">
                            {measures.map((m) => (
                                <div
                                    key={m.b_id_measure}
                                    className="flex items-start justify-between gap-4 px-4 py-3 bg-background hover:bg-muted/30 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                                                {m.m_id.replace("bln_", "")}
                                            </span>
                                            <span className="text-sm font-medium truncate">
                                                {m.m_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-muted-foreground">
                                                {formatDateRange(
                                                    m.m_start,
                                                    m.m_end,
                                                )}
                                            </span>
                                            {!m.m_end && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-5 px-2 text-xs"
                                                    onClick={() =>
                                                        setClosingMeasure({
                                                            b_id_measure:
                                                                m.b_id_measure,
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
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                            title="Bewerken / afsluiten"
                                            onClick={() =>
                                                setEditingMeasure({
                                                    b_id_measure:
                                                        m.b_id_measure,
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
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    title="Verwijderen"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>
                                                        Maatregel verwijderen?
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Wil je &ldquo;{m.m_name}
                                                        &rdquo; definitief
                                                        verwijderen? Dit kan
                                                        niet ongedaan worden
                                                        gemaakt.
                                                        <br />
                                                        <br />
                                                        <span className="text-foreground font-medium">
                                                            Wil je de maatregel
                                                            alleen beëindigen?
                                                        </span>{" "}
                                                        Gebruik dan de
                                                        bewerkknop (
                                                        <Pencil className="inline h-3.5 w-3.5 mx-0.5" />
                                                        ) en stel een einddatum
                                                        in.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>
                                                        Annuleren
                                                    </AlertDialogCancel>
                                                    <form method="post">
                                                        <input
                                                            type="hidden"
                                                            name="intent"
                                                            value="delete"
                                                        />
                                                        <input
                                                            type="hidden"
                                                            name="b_id_measure"
                                                            value={
                                                                m.b_id_measure
                                                            }
                                                        />
                                                        <AlertDialogAction
                                                            type="submit"
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full"
                                                            disabled={
                                                                navigation.state !==
                                                                "idle"
                                                            }
                                                        >
                                                            Definitief
                                                            verwijderen
                                                        </AlertDialogAction>
                                                    </form>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mini map */}
                <div className="xl:w-96 xl:shrink-0 w-full rounded-lg overflow-hidden border">
                    <Suspense
                        fallback={
                            <div className="h-64 bg-muted animate-pulse rounded-lg" />
                        }
                    >
                        <MeasuresMap
                            fieldsGeoJSON={fieldsGeoJSON}
                            selectedFieldGeoJSON={selectedFieldGeoJSON}
                            initialFitGeoJSON={selectedFieldGeoJSON}
                            mapStyle={mapStyle}
                            basePath={basePath}
                            height="400px"
                        />
                    </Suspense>
                </div>
            </div>

            {/* Add Measure dialog */}
            <AddMeasureDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                catalogue={catalogue}
                activeMeasures={measures}
                calendarYearStart={calendarYearStart}
                harvestDate={harvestDate}
            />

            {/* Edit Measure dialog */}
            <MeasureEditDialog
                measure={editingMeasure}
                onClose={() => setEditingMeasure(null)}
            />

            {/* Close Measure dialog */}
            <MeasureEditDialog
                measure={closingMeasure}
                closeMode
                onClose={() => setClosingMeasure(null)}
            />
        </div>
    )
}
