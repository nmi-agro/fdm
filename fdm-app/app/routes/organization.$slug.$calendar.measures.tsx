import {
    getCultivationsForFarm,
    getFarms,
    getFields,
    getMeasuresForFarm,
    type Measure,
} from "@nmi-agro/fdm-core"
import type { FeatureCollection } from "geojson"
import { ClipboardList } from "lucide-react"
import { lazy, Suspense, useMemo } from "react"
import {
    data,
    type MetaFunction,
    useLoaderData,
    useNavigate,
    useParams,
} from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { DataTableColumnHeader } from "~/components/blocks/fields/column-header"
import {
    getColumns,
    getOrganizationCustomColumns,
    type MeasureTableRow,
} from "~/components/blocks/measures/columns"
import { getFieldSummaryColumns } from "~/components/blocks/measures/field-summary-columns"
import { FieldSummaryTable } from "~/components/blocks/measures/field-summary-table"
import { MeasuresDataTable } from "~/components/blocks/measures/table"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { getMapStyle } from "~/integrations/map"
import { auth } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getDefaultCultivation } from "~/lib/cultivation-helpers"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/organization.$slug.$calendar.measures"
import { buildFarmMultiPolygon } from "./organization.$slug.$calendar.atlas.indicators"

const MeasuresMap = lazy(
    () => import("@/app/components/blocks/measures/measures-atlas"),
)
export const meta: MetaFunction = () => {
    return [
        {
            title: `Maatregelen | Organisatieoverzicht | ${clientConfig.name}`,
        },
        {
            name: "description",
            content:
                "Overzicht van bodembeheersmaatregelen per perceel voor het hele bedrijf.",
        },
    ]
}

type MeasureAggregate = {
    m_id: string
    m_name: string
    m_start: Date | null
    m_end: Date | null
    fieldCount: number
    farmCount: number
}

type MainCultivation = {
    b_lu_catalogue: string
    b_lu_name: string
    b_lu_croprotation: string | null
}

export async function loader({ request, params }: Route.LoaderArgs) {
    try {
        const timeframe = getTimeframe(params)
        const calendar = getCalendar(params)

        const allOrganizations = await auth.api.listOrganizations({
            headers: request.headers,
        })
        const organization = allOrganizations.find(
            (org) => org.slug === params.slug,
        )

        if (!organization) {
            throw data("Organisatie niet gevonden.", {
                status: 404,
                statusText: "Organisatie niet gevonden.",
            })
        }

        const farms = await getFarms(fdm, organization.id)

        function combineMeasureAggregate(
            existing: MeasureAggregate | undefined,
            measure: Measure,
        ): MeasureAggregate {
            if (!existing) {
                return {
                    ...measure,
                    fieldCount: 1,
                    farmCount: 0,
                }
            }

            return {
                ...existing,
                m_start:
                    !existing.m_start || !measure.m_start
                        ? null
                        : existing.m_start < measure.m_start
                          ? existing.m_start
                          : measure.m_start,
                m_end:
                    !existing.m_end || !measure.m_end
                        ? null
                        : existing.m_end > measure.m_end
                          ? existing.m_end
                          : measure.m_end,
                fieldCount: existing.fieldCount + 1,
                // Do not increment farmCount here. It won't work.
            }
        }

        const farmFields = new Map<
            string,
            Awaited<ReturnType<typeof getFields>>
        >()

        await Promise.all(
            farms.map(async (farm) => {
                const fields = await getFields(
                    fdm,
                    organization.id,
                    farm.b_id_farm,
                    timeframe,
                )
                farmFields.set(farm.b_id_farm, fields)
            }),
        )

        // Build field list for the dialog — enrich with cultivation + area
        const farmMeasures = new Map<
            string,
            {
                measures: MeasureAggregate[]
                mainCultivations: MainCultivation[]
            }
        >()
        await Promise.all(
            farms.map(async (farm) => {
                const [fieldMeasuresMap, farmCultivations] = await Promise.all([
                    getMeasuresForFarm(
                        fdm,
                        organization.id,
                        farm.b_id_farm,
                        timeframe,
                    ),
                    getCultivationsForFarm(
                        fdm,
                        organization.id,
                        farm.b_id_farm,
                        timeframe,
                    ),
                ])
                const collectedMeasures = new Map<string, MeasureAggregate>()
                for (const fieldMeasures of fieldMeasuresMap.values()) {
                    for (const measure of fieldMeasures) {
                        const existingMeasure = collectedMeasures.get(
                            measure.m_id,
                        )
                        collectedMeasures.set(
                            measure.m_id,
                            combineMeasureAggregate(existingMeasure, measure),
                        )
                    }
                }

                const collectedCultivations: MainCultivation[] = []

                const b_lu_catalogue_added = new Set<string>()
                for (const fieldCultivations of farmCultivations.values()) {
                    const defaultCultivation = getDefaultCultivation(
                        fieldCultivations,
                        calendar,
                    )

                    if (
                        defaultCultivation?.b_lu_catalogue &&
                        !b_lu_catalogue_added.has(
                            defaultCultivation.b_lu_catalogue,
                        )
                    ) {
                        b_lu_catalogue_added.add(
                            defaultCultivation.b_lu_catalogue,
                        )
                        collectedCultivations.push({
                            b_lu_catalogue: defaultCultivation.b_lu_catalogue,
                            b_lu_name: defaultCultivation.b_lu_name ?? null,
                            b_lu_croprotation:
                                defaultCultivation.b_lu_croprotation ?? null,
                        })
                    }
                }

                farmMeasures.set(farm.b_id_farm, {
                    measures: [...collectedMeasures.values()],
                    mainCultivations: collectedCultivations,
                })
            }),
        )

        // Build GeoJSON with measureCount per field
        const fieldsGeoJSON: FeatureCollection = {
            type: "FeatureCollection",
            features: farms.map((farm) => ({
                type: "Feature" as const,
                properties: {
                    b_id: farm.b_id_farm,
                    b_name: farm.b_name_farm ?? null,
                    b_area: farmFields
                        .get(farm.b_id_farm)
                        ?.reduce(
                            (total, field) => total + (field.b_area ?? 0),
                            0,
                        ),
                    measureCount:
                        farmMeasures.get(farm.b_id_farm)?.measures.length ?? 0,
                },
                geometry: buildFarmMultiPolygon(
                    farmFields.get(farm.b_id_farm) ?? [],
                ),
            })),
        }

        // Build unique-measure rows grouped by m_id, including dates
        const measuresByMId = new Map<string, MeasureTableRow>()
        for (const farm of farms) {
            const measures = farmMeasures.get(farm.b_id_farm)?.measures
            if (!measures) continue
            for (const m of measures) {
                const fieldEntry = {
                    b_id: farm.b_id_farm,
                    b_name: farm.b_name_farm ?? null,
                    b_id_measure: `${farm.b_id_farm}#${m.m_id}`,
                    m_start: m.m_start,
                    m_end: m.m_end,
                }
                const existing = measuresByMId.get(m.m_id)
                if (existing) {
                    existing.fields.push(fieldEntry)
                    existing.actualFieldCount =
                        (existing.actualFieldCount ?? 0) + m.fieldCount
                } else {
                    measuresByMId.set(m.m_id, {
                        m_id: m.m_id,
                        m_name: m.m_name,
                        fields: [fieldEntry],
                        actualFieldCount: m.fieldCount,
                    })
                }
            }
        }
        const measureRows: MeasureTableRow[] = [...measuresByMId.values()].sort(
            (a, b) => a.m_name.localeCompare(b.m_name, "nl"),
        )

        // Compute summary stats from measuresMap (no extra API calls needed)
        const totalMeasures = [...farmMeasures.values()].reduce(
            (sum, entry) => sum + entry.measures.length,
            0,
        )
        const fieldsWithMeasures = [...farmMeasures.values()].filter(
            (x) => x.measures.length > 0,
        ).length
        const fieldsWithoutMeasures = farms.length - fieldsWithMeasures

        // Per-field summary for the table — derived from existing data
        const fieldSummaries = farms.map((farm) => {
            const { measures, mainCultivations } = farmMeasures.get(
                farm.b_id_farm,
            ) ?? { measures: [], mainCultivations: [] }
            return {
                b_id: farm.b_id_farm,
                b_name: farm.b_name_farm ?? null,
                b_area: (farmFields.get(farm.b_id_farm) ?? []).reduce(
                    (total, field) => total + (field.b_area ?? 0),
                    0,
                ),
                b_bufferstrip: false,
                mainCultivations: mainCultivations,
                measures: measures.map((m) => ({
                    m_name: m.m_name,
                })),
            }
        })

        return {
            fieldsGeoJSON,
            measureRows,
            mapStyle: getMapStyle("satellite"),
            fieldSummaries,
            stats: {
                totalFields: farms.length,
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

// ── Page component ────────────────────────────────────────────────────────────

export default function MeasuresOrganizationIndex() {
    const { fieldsGeoJSON, measureRows, mapStyle, stats, fieldSummaries } =
        useLoaderData<typeof loader>()
    const { calendar } = useParams()
    const navigate = useNavigate()

    const basePathFormatter = (b_id: string) =>
        `/farm/${b_id}/${calendar}/measures`

    const columns = getColumns(basePathFormatter).filter(
        (c) => c.id !== "actions" && c.id !== "fields",
    )
    columns.push(...getOrganizationCustomColumns(basePathFormatter))
    const fieldSummaryColumns = useMemo(() => {
        const columns = getFieldSummaryColumns()
        const cultivationColumn = columns.find(
            (col) =>
                (col as unknown as { accessorKey: string }).accessorKey ===
                "mainCultivation",
        )
        if (cultivationColumn) {
            cultivationColumn.header = ({ column }) => (
                <DataTableColumnHeader column={column} title="Gewassen" />
            )
        }
        return columns
    }, [])

    // Enrich fieldSummaries with the href for each field
    const fieldSummaryRows = useMemo(
        () =>
            fieldSummaries.map((f) => ({
                ...f,
                href: `/farm/${f.b_id}/${calendar}/measures`,
            })),
        [fieldSummaries, calendar],
    )

    const emptyGeoJSON: FeatureCollection = {
        type: "FeatureCollection",
        features: [],
    }

    const handleFieldClick = (b_id: string) => {
        navigate(basePathFormatter(b_id))
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
                        verbeteren. Klik op een bedrijf op de kaart om te
                        beginnen.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        ) : (
            <MeasuresDataTable
                columns={columns}
                data={measureRows}
                canModify={false}
            />
        )

    return (
        <>
            <FarmTitle
                title="Maatregelen"
                description="Overzicht van bodembeheersmaatregelen per bedrijf met toegang door deze organisatie."
            />

            <div className="md:px-8 md:pb-8 space-y-6">
                {/* Summary stats banner */}
                {stats.totalFields > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-lg border bg-card px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                                Actieve maatregelen
                            </p>
                            <p className="text-2xl font-bold tabular-nums mt-0.5">
                                {stats.totalMeasures}
                            </p>
                        </div>
                        <div className="rounded-lg border bg-card px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                                Bedrijven met maatregel
                            </p>
                            <p className="text-2xl font-bold tabular-nums mt-0.5">
                                {stats.fieldsWithMeasures}
                            </p>
                        </div>

                        <div className="rounded-lg border px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                                Bedrijven zonder maatregel
                            </p>
                            <p className="text-2xl font-bold tabular-nums mt-0.5">
                                {stats.fieldsWithoutMeasures}
                            </p>
                        </div>
                    </div>
                )}

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
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                Bedrijven
                            </h3>
                            <FieldSummaryTable
                                columns={fieldSummaryColumns}
                                data={fieldSummaryRows}
                                canModify={false}
                            />
                        </div>
                    </>
                )}
            </div>
        </>
    )
}
