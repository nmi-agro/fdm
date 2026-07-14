import type { FeatureCollection, MultiPolygon } from "geojson"
import {
  getCultivationsForFarm,
  getFarms,
  getFields,
  getMeasuresForFarm,
  type Measure,
} from "@nmi-agro/fdm-core"
import { ClipboardList } from "lucide-react"
import { lazy, Suspense, useMemo } from "react"
import { data, type MetaFunction, useLoaderData, useNavigate, useParams } from "react-router"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { DataTableColumnHeader } from "~/components/blocks/fields/column-header"
import { getColumns, type MeasureTableRow } from "~/components/blocks/measures/columns"
import { getFieldSummaryColumns } from "~/components/blocks/measures/field-summary-columns"
import { FieldSummaryTable } from "~/components/blocks/measures/field-summary-table"
import { MeasuresDataTable } from "~/components/blocks/measures/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { Separator } from "~/components/ui/separator"
import { getMapStyle } from "~/integrations/map"
import { auth } from "~/lib/auth.server"
import { getCalendar, getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { getDefaultCultivation } from "~/lib/cultivation-helpers.server"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/organization.$slug.$calendar.measures"

const MeasuresMap = lazy(() => import("@/app/components/blocks/measures/measures-atlas"))
export const meta: MetaFunction = () => {
  return [
    {
      title: `Maatregelen | Organisatieoverzicht | ${clientConfig.name}`,
    },
    {
      name: "description",
      content: "Overzicht van bodembeheersmaatregelen per perceel voor het hele bedrijf.",
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

export function buildFarmMultiPolygon(
  fields: Array<{
    b_geometry:
      | {
          type: "Polygon"
          coordinates: MultiPolygon["coordinates"][number]
        }
      | {
          type: "MultiPolygon"
          coordinates: MultiPolygon["coordinates"]
        }
      | null
  }>,
): MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: fields.flatMap((field) => {
      if (!field.b_geometry) return []
      return field.b_geometry.type === "MultiPolygon"
        ? field.b_geometry.coordinates
        : [field.b_geometry.coordinates]
    }),
  }
}

export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    const timeframe = getTimeframe(params)
    const calendar = getCalendar(params)

    const allOrganizations = await auth.api.listOrganizations({
      headers: request.headers,
    })
    const organization = allOrganizations.find((org) => org.slug === params.slug)

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

    const farmFields = new Map<string, Awaited<ReturnType<typeof getFields>>>()

    await Promise.all(
      farms.map(async (farm) => {
        const fields = await getFields(fdm, organization.id, farm.b_id_farm, timeframe)
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
          getMeasuresForFarm(fdm, organization.id, farm.b_id_farm, timeframe),
          getCultivationsForFarm(fdm, organization.id, farm.b_id_farm, timeframe),
        ])
        const collectedMeasures = new Map<string, MeasureAggregate>()
        for (const fieldMeasures of fieldMeasuresMap.values()) {
          for (const measure of fieldMeasures) {
            const existingMeasure = collectedMeasures.get(measure.m_id)
            collectedMeasures.set(measure.m_id, combineMeasureAggregate(existingMeasure, measure))
          }
        }

        const collectedCultivations = new Map<
          string,
          {
            b_lu_catalogue: string
            b_lu_name: string
            b_lu_croprotation: string | null
            b_area: number
          }
        >()
        for (const field of farmFields.get(farm.b_id_farm) ?? []) {
          const fieldCultivations = farmCultivations.get(field.b_id)
          if (!fieldCultivations || fieldCultivations.length === 0) continue
          const defaultCultivation = getDefaultCultivation(fieldCultivations, calendar)

          if (defaultCultivation?.b_lu_catalogue) {
            const existing = collectedCultivations.get(defaultCultivation.b_lu_catalogue)
            if (existing) {
              existing.b_area += field.b_area ?? 0
            } else {
              collectedCultivations.set(defaultCultivation.b_lu_catalogue, {
                b_lu_catalogue: defaultCultivation.b_lu_catalogue,
                b_lu_name: defaultCultivation.b_lu_name,
                b_lu_croprotation: defaultCultivation.b_lu_croprotation,
                b_area: field.b_area ?? 0,
              })
            }
          }
        }

        const mainCultivations = [...collectedCultivations.values()].sort(
          (a, b) => b.b_area - a.b_area,
        )

        farmMeasures.set(farm.b_id_farm, {
          measures: [...collectedMeasures.values()],
          mainCultivations: mainCultivations,
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
            ?.reduce((total, field) => total + (field.b_area ?? 0), 0),
          measureCount: farmMeasures.get(farm.b_id_farm)?.measures.length ?? 0,
        },
        geometry: buildFarmMultiPolygon(farmFields.get(farm.b_id_farm) ?? []),
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
          existing.actualFieldCount = (existing.actualFieldCount ?? 0) + m.fieldCount
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

    const measureRows: MeasureTableRow[] = [...measuresByMId.values()].sort((a, b) =>
      a.m_name.localeCompare(b.m_name, "nl"),
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
      const { measures, mainCultivations } = farmMeasures.get(farm.b_id_farm) ?? {
        measures: [],
        mainCultivations: [],
      }
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
          num_fields:
            farmMeasures.get(farm.b_id_farm)?.measures.find((cm) => cm.m_id === m.m_id)
              ?.fieldCount ?? 0,
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

  const basePathFormatter = (b_id: string) => `/farm/${b_id}/${calendar}/measures`

  const columns = getColumns(basePathFormatter, "organization")
  const fieldSummaryColumns = useMemo(() => {
    const columns = getFieldSummaryColumns()
    const cultivationColumn = columns.find(
      (col) => (col as unknown as { accessorKey: string }).accessorKey === "mainCultivation",
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
    void navigate(basePathFormatter(b_id))
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
            bodemkwaliteit te verbeteren. Klik op een bedrijf op de kaart om te beginnen.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      <MeasuresDataTable columns={columns} data={measureRows} canModify={false} />
    )

  return (
    <>
      <FarmTitle
        title="Maatregelen"
        description="Overzicht van bodembeheersmaatregelen per bedrijf met toegang door deze organisatie."
      />

      <div className="space-y-6 md:px-8 md:pb-8">
        {/* Summary stats banner */}
        {stats.totalFields > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="bg-card rounded-lg border px-4 py-3">
              <p className="text-muted-foreground text-xs">Actieve maatregelen</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.totalMeasures}</p>
            </div>
            <div className="bg-card rounded-lg border px-4 py-3">
              <p className="text-muted-foreground text-xs">Bedrijven met maatregel</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums">{stats.fieldsWithMeasures}</p>
            </div>

            <div className="rounded-lg border px-4 py-3">
              <p className="text-muted-foreground text-xs">Bedrijven zonder maatregel</p>
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
