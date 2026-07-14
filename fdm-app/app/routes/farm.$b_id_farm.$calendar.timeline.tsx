import {
  checkPermission,
  getCultivationsForFarm,
  getFarms,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
  getHarvestsForFarm,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import { Smartphone } from "lucide-react"
import { useMemo, useState } from "react"
import { data, type MetaFunction, useLoaderData, useParams } from "react-router"
import type { TimelineFilters } from "~/components/blocks/timeline/gantt-view"
import type { Range } from "~/components/kibo-ui/gantt"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { TimelineGanttView } from "~/components/blocks/timeline/gantt-view"
import { TimelineToolbar } from "~/components/blocks/timeline/toolbar"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { SidebarInset } from "~/components/ui/sidebar"
import { useIsMobile } from "~/hooks/use-mobile"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.timeline"

export const meta: MetaFunction = () => {
  return [
    { title: `Tijdlijn | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk in één overzicht alle gewassen, bemestingen, oogsten en bodemmonsters van je bedrijf op een tijdlijn.",
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
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

    await checkPermission(fdm, "farm", "read", b_id_farm, session.principal_id, "timeline")

    const farms = await getFarms(fdm, session.principal_id)
    if (!farms || farms.length === 0) {
      throw data("not found: farms", {
        status: 404,
        statusText: "not found: farms",
      })
    }

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    // Fetch all timeline-relevant data for the whole farm in parallel, using the
    // farm-scoped batch functions (single query + single permission check each)
    // rather than looping per field.
    const [
      fields,
      cultivationsByField,
      fertilizerApplicationsByField,
      harvestsByCultivation,
      soilAnalysesByField,
      fertilizers,
    ] = await Promise.all([
      getFields(fdm, session.principal_id, b_id_farm, timeframe),
      getCultivationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getFertilizerApplicationsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getHarvestsForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getSoilAnalysesForFarm(fdm, session.principal_id, b_id_farm, timeframe),
      getFertilizers(fdm, session.principal_id, b_id_farm),
    ])

    const fertilizerTypeById = new Map(fertilizers.map((f) => [f.p_id, f.p_type]))

    const timelineFields = fields
      .map((field) => {
        if (!field?.b_id || !field?.b_name) {
          throw new Error("Invalid field data structure")
        }

        const cultivations = cultivationsByField.get(field.b_id) ?? []
        const harvests = cultivations.flatMap((cultivation) =>
          (harvestsByCultivation.get(cultivation.b_lu) ?? []).map((harvest) => ({
            b_id_harvesting: harvest.b_id_harvesting,
            b_lu: harvest.b_lu,
            b_lu_name: cultivation.b_lu_name,
            b_lu_harvest_date: harvest.b_lu_harvest_date,
          })),
        )

        return {
          b_id: field.b_id,
          b_name: field.b_name,
          b_area: field.b_area != null ? Math.round(field.b_area * 10) / 10 : 0,
          b_bufferstrip: field.b_bufferstrip ?? false,
          cultivations: cultivations.map((cultivation) => ({
            b_lu: cultivation.b_lu,
            b_lu_name: cultivation.b_lu_name,
            b_lu_croprotation: cultivation.b_lu_croprotation,
            b_lu_start: cultivation.b_lu_start,
            b_lu_end: cultivation.b_lu_end,
          })),
          fertilizerApplications: fertilizerApplicationsByField.get(field.b_id) ?? [],
          harvests,
          soilAnalyses: soilAnalysesByField.get(field.b_id) ?? [],
        }
      })
      .sort((a, b) => a.b_name.localeCompare(b.b_name, "nl"))

    return {
      b_id_farm,
      farmOptions,
      fields: timelineFields,
      fertilizerTypeById: Object.fromEntries(fertilizerTypeById),
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

export default function TimelinePage() {
  const loaderData = useLoaderData<typeof loader>()
  const { calendar } = useParams()
  const isMobile = useIsMobile()

  const [range, setRange] = useState<Range>("monthly")
  const [filters, setFilters] = useState<TimelineFilters>({
    showBufferStrips: false,
    showCultivations: true,
    showFertilizers: true,
    showHarvests: true,
    showSoilSamplings: true,
  })

  const currentFarmName =
    loaderData.farmOptions.find((farm) => farm.b_id_farm === loaderData.b_id_farm)?.b_name_farm ??
    ""

  const calendarYear = useMemo(() => {
    const parsed = Number(calendar)
    return Number.isNaN(parsed) ? new Date().getFullYear() : parsed
  }, [calendar])

  const fertilizerTypeById = useMemo(
    () => new Map(Object.entries(loaderData.fertilizerTypeById)),
    [loaderData.fertilizerTypeById],
  )

  const action = {
    to: `/farm/${loaderData.b_id_farm}`,
    label: "Terug naar bedrijf",
    disabled: false,
  }

  return (
    <SidebarInset>
      <Header action={action}>
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Tijdlijn</BreadcrumbItem>
      </Header>
      <main className="min-w-0">
        {isMobile ? (
          <>
            <FarmTitle
              title={`Tijdlijn van ${currentFarmName}`}
              description="Overzicht van alle gebeurtenissen op je bedrijf."
            />
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Smartphone className="text-muted-foreground h-10 w-10" />
                  </EmptyMedia>
                  <EmptyTitle>Tijdlijn binnenkort beschikbaar op mobiel</EmptyTitle>
                  <EmptyDescription>
                    De tijdlijn is momenteel alleen beschikbaar op een groter scherm. We werken aan
                    een mobiele weergave.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          </>
        ) : (
          <>
            <FarmTitle
              title={`Tijdlijn van ${currentFarmName}`}
              description="Overzicht van alle gewassen, bemestingen, oogsten en bodemmonsters over de percelen."
              rightNode={
                <TimelineToolbar
                  filters={filters}
                  onFiltersChange={setFilters}
                  onRangeChange={setRange}
                  range={range}
                />
              }
            />
            <FarmContent>
              <TimelineGanttView
                b_id_farm={loaderData.b_id_farm}
                calendar={calendar ?? ""}
                calendarYear={calendarYear}
                fertilizerTypeById={fertilizerTypeById}
                fields={loaderData.fields}
                filters={filters}
                range={range}
              />
            </FarmContent>
          </>
        )}
      </main>
    </SidebarInset>
  )
}
