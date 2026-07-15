import {
  checkPermission,
  getCultivationsForFarm,
  getFarms,
  getFertilizerApplicationsForFarm,
  getFertilizers,
  getFields,
  getParametersForHarvestCat,
  getHarvestsForFarm,
  getSoilAnalysesForFarm,
} from "@nmi-agro/fdm-core"
import { Smartphone } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { data, type MetaFunction, useLoaderData, useParams } from "react-router"
import type {
  TimelineFilters,
  TimelineGanttViewHandle,
} from "~/components/blocks/timeline/gantt-view"
import type { Range } from "~/components/kibo-ui/gantt"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { TimelineGanttView } from "~/components/blocks/timeline/gantt-view"
import { TimelineMobileView } from "~/components/blocks/timeline/mobile-view"
import { TimelineToolbar } from "~/components/blocks/timeline/toolbar"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { SidebarInset } from "~/components/ui/sidebar"
import { useIsMobile } from "~/hooks/use-mobile"
import { getSession } from "~/lib/auth.server"
import { endMonth, getTimeframeForYears, startMonth } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { fetchTimelineFields } from "~/lib/timeline-data.server"
import { useCalendarJump } from "~/store/calendar"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.timeline"

// The years the timeline can ever request must stay within the app's supported Calendar range
// (see ~/lib/calendar's getCalendarSelection), so scrolling can never ask for a year that isn't a
// selectable calendar year anywhere else in the app.
const TIMELINE_START_YEAR = startMonth.getFullYear()
const TIMELINE_END_YEAR = endMonth.getFullYear()

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

    // The Gantt itself renders/lets users scroll across the whole supported year range (see
    // TIMELINE_START_YEAR/END_YEAR in gantt-view.tsx), so it fetches that same full range up
    // front rather than just the single selected year — otherwise scrolling into any other year
    // always looked empty, even when it genuinely had data.
    const [timelineFields, fertilizers] = await Promise.all([
      fetchTimelineFields(
        session.principal_id,
        b_id_farm,
        getTimeframeForYears(TIMELINE_START_YEAR, TIMELINE_END_YEAR),
      ),
      getFertilizers(fdm, session.principal_id, b_id_farm),
    ])

    const fertilizerTypeById = new Map(fertilizers.map((f) => [f.p_id, f.p_type]))

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
  const ganttRef = useRef<TimelineGanttViewHandle>(null)
  const registerJumpToYear = useCalendarJump((state) => state.registerJumpToYear)

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

  // While this page is mounted, let the sidebar's Calendar year selector scroll the already-
  // loaded timeline to a year instead of triggering a full page navigation (every other route is
  // unaffected — they never register a handler here, so the sidebar falls back to navigating).
  useEffect(() => {
    return registerJumpToYear((yearString) => {
      const year = Number(yearString)
      if (!Number.isInteger(year) || year < TIMELINE_START_YEAR || year > TIMELINE_END_YEAR) {
        return false
      }
      if (!ganttRef.current) {
        return false
      }
      ganttRef.current.scrollToYear(year)
      return true
    })
  }, [registerJumpToYear])

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
            <TimelineMobileView
              b_id_farm={loaderData.b_id_farm}
              calendar={calendar ?? ""}
              fertilizerTypeById={fertilizerTypeById}
              fields={loaderData.fields}
              filters={filters}
              onFiltersChange={setFilters}
            />
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
                  onJumpToToday={() => ganttRef.current?.scrollToToday()}
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
                onFiltersChange={setFilters}
                range={range}
                ref={ganttRef}
              />
            </FarmContent>
          </>
        )}
      </main>
    </SidebarInset>
  )
}
