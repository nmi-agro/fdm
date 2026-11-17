import {
  addGrazing,
  checkPermission,
  getFarm,
  getFarms,
  removeGrazing,
  updateGrazing,
} from "@nmi-agro/fdm-core"
import { getLastCultivationAvailabilityYear } from "@nmi-agro/fdm-data"
import { format } from "date-fns"
import {
  ChartColumn,
  ChevronDown,
  Compass,
  Plus,
  Shovel,
  Sparkles,
  SquareArrowRightExit,
  Warehouse,
  Wheat,
} from "lucide-react"
import { type ReactNode, useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useActionData,
  useLoaderData,
} from "react-router"
import { dataWithSuccess } from "remix-toast"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { CalendarGrid } from "~/components/blocks/grazing/calendar-grid"
import { QuickEntrySheet } from "~/components/blocks/grazing/quick-entry-sheet"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddEventSheet } from "~/components/blocks/timeline/add-event-sheet"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { SidebarInset } from "~/components/ui/sidebar"
import { useToday } from "~/hooks/use-today"
import { getSession } from "~/lib/auth.server"
import { getTimeframe } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError, isToastResponse } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  FieldEventSchema,
  getFertilizerOptions,
  handleFieldEvent,
  isFieldEventIntent,
} from "~/lib/field-events.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { fetchGrazingCalendarMatrix, type GrazingCalendarView } from "~/lib/grazing-calendar.server"
import { defaultMapDay } from "~/lib/grazing-map"
import { GRAZING_AREA_FIELD, GRAZING_ZONE_FIELD, parseGrazingExtent } from "~/lib/grazing-zone"
import { fetchTimelineFields } from "~/lib/timeline-data.server"

export const handle: HelpHandle = { help: "beweiding" }

export const meta: MetaFunction = () => {
  return [
    { title: `Beweiding | ${clientConfig.name}` },
    {
      name: "description",
      content: "Beweidingskalender en graslandgebruik per perceel.",
    },
  ]
}

/**
 * The view of the calendar from the URL: `?weergave=dag&maand=6` shows the days of June, anything
 * else the weeks of the year. Without a month, the day view shows the current month.
 */
function getCalendarView(searchParams: URLSearchParams): GrazingCalendarView {
  if (searchParams.get("weergave") !== "dag") return { kind: "week" }
  const month = Number(searchParams.get("maand"))
  return {
    kind: "day",
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1,
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
    const calendarYear = parseInt(calendar, 10) || new Date().getFullYear()

    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)

    const [farm, farms, matrix, timelineFields, fertilizerOptions] = await Promise.all([
      getFarm(fdm, session.principal_id, b_id_farm),
      getFarms(fdm, session.principal_id),
      fetchGrazingCalendarMatrix(
        session.principal_id,
        b_id_farm,
        calendarYear,
        getCalendarView(new URL(request.url).searchParams),
      ),
      // Cultivations, harvests and fertilizer applications per field, for the mowing and
      // fertilizing forms shared with the Tijdlijn
      fetchTimelineFields(session.principal_id, b_id_farm, getTimeframe(params)),
      getFertilizerOptions(session.principal_id, b_id_farm),
    ])
    const grasslandIds = new Set(matrix.fields.map((f) => f.b_id))

    const farmOptions = farms.map((f) => ({
      b_id_farm: f.b_id_farm,
      b_name_farm: f.b_name_farm,
    }))

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )

    return {
      b_id_farm,
      b_name_farm: farm.b_name_farm,
      calendar,
      farmOptions,
      calendarYear,
      matrix,
      openGrazings: matrix.openGrazings,
      grasslandFields: timelineFields.filter((field) => grasslandIds.has(field.b_id)),
      fertilizerOptions,
      lastCultivationAvailabilityYear: await getLastCultivationAvailabilityYear(),
      farmWritePermission,
    }
  } catch (error) {
    throw handleLoaderError(error)
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const b_id_farm = params.b_id_farm
    const calendar = params.calendar ?? String(new Date().getFullYear())
    if (!b_id_farm) {
      throw data("Farm ID is required", { status: 400 })
    }

    const session = await getSession(request)
    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      new URL(request.url).pathname,
      false,
    )
    if (!farmWritePermission) {
      throw data("U heeft geen schrijfrechten op dit bedrijf.", { status: 403 })
    }

    // Read a copy, so a mowing or fertilizing form can still be parsed from the request
    const formData = await request.clone().formData()
    const intent = String(formData.get("intent") ?? "")

    // Mowing and fertilizing, with the same forms and handling as the Tijdlijn
    if (isFieldEventIntent(intent)) {
      const values = await extractFormValuesFromRequest(request, FieldEventSchema)
      return await handleFieldEvent(values, {
        principal_id: session.principal_id,
        b_id_farm,
        calendar,
        source: "grazing_calendar",
      })
    }

    if (intent === "add_grazing") {
      const b_id = String(formData.get("b_id") ?? "")
      const l_id_herd = String(formData.get("l_id_herd") ?? "")
      const l_grazing_start = new Date(String(formData.get("l_grazing_start")))
      const endVal = formData.get("l_grazing_end")
      const l_grazing_end = endVal ? new Date(String(endVal)) : undefined
      const hoursVal = formData.get("l_grazing_hours")
      const l_grazing_hours = hoursVal ? parseFloat(String(hoursVal)) : undefined

      await addGrazing(fdm, session.principal_id, l_id_herd, l_grazing_start, {
        b_id: b_id || undefined,
        l_grazing_end,
        l_grazing_hours,
        ...parseGrazingExtent(formData),
      })

      return dataWithSuccess(
        {},
        {
          message: `Beweiding vastgelegd. Beweiding ${calendar} staat aan en telt mee voor de stikstofgebruiksnorm.`,
        },
      )
    }

    if (intent === "update_grazing") {
      const l_id_grazing = String(formData.get("l_id_grazing") ?? "")
      const startVal = formData.get("l_grazing_start")
      const endVal = formData.get("l_grazing_end")
      const hoursVal = formData.get("l_grazing_hours")
      const extent = parseGrazingExtent(formData)

      await updateGrazing(fdm, session.principal_id, l_id_grazing, {
        l_grazing_start: startVal ? new Date(String(startVal)) : undefined,
        l_grazing_end: endVal ? new Date(String(endVal)) : undefined,
        l_grazing_hours: hoursVal ? parseFloat(String(hoursVal)) : undefined,
        // Only change the grazed part when the form sends it, so closing a grazing keeps its zone
        ...(formData.has(GRAZING_ZONE_FIELD)
          ? { l_grazing_geometry_zone: extent.l_grazing_geometry_zone }
          : {}),
        ...(formData.has(GRAZING_AREA_FIELD) ? { l_grazing_area: extent.l_grazing_area } : {}),
      })

      return dataWithSuccess({}, { message: "Beweidingsregistratie bijgewerkt." })
    }

    if (intent === "remove_grazing") {
      const l_id_grazing = String(formData.get("l_id_grazing") ?? "")
      await removeGrazing(fdm, session.principal_id, l_id_grazing)
      return dataWithSuccess({}, { message: "Beweiding verwijderd." })
    }

    throw data("Ongeldige actie", { status: 400 })
  } catch (error) {
    // extractFormValuesFromRequest already turned validation errors into a toast response
    if (isToastResponse(error)) return error
    return handleActionError(error)
  }
}

export default function BeweidingskalenderPage() {
  const {
    b_id_farm,
    calendar,
    calendarYear,
    farmOptions,
    matrix,
    openGrazings,
    grasslandFields,
    fertilizerOptions,
    lastCultivationAvailabilityYear,
    farmWritePermission,
  } = useLoaderData<typeof loader>()
  const actionData = useActionData<{ closeSheet?: boolean }>()

  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false)

  // The mowing or fertilizing form, tagged with the action data it was opened under. It closes
  // when a newer save reports `closeSheet`, derived here instead of set in an effect.
  const [sheetState, setSheetState] = useState<
    { request: AddEventSheetRequest; openedWithActionData: unknown } | undefined
  >()
  const sheetRequest =
    sheetState && !(actionData !== sheetState.openedWithActionData && actionData?.closeSheet)
      ? sheetState.request
      : undefined
  const openSheet = (request: AddEventSheetRequest | undefined) =>
    setSheetState(request ? { request, openedWithActionData: actionData } : undefined)

  // New mowing and fertilizing default to today, or the same day in another year
  const today = useToday()
  const defaultDate = today
    ? new Date(`${defaultMapDay(format(today, "yyyy-MM-dd"), calendarYear)}T12:00:00`)
    : undefined

  const hasKoppels = matrix.herds.length > 0
  const hasGrassland = matrix.fields.length > 0

  return (
    <SidebarInset>
      <Header
        action={{
          to: `/farm/${b_id_farm}`,
          label: "Terug naar bedrijf",
          disabled: false,
        }}
      >
        <HeaderFarm b_id_farm={b_id_farm} farmOptions={farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem>Beweiding</BreadcrumbItem>
      </Header>

      <main>
        <FarmTitle
          title={`Beweiding ${calendar}`}
          description="Plan en registreer de beweiding en het graslandgebruik van je percelen."
          rightNode={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                nativeButton={false}
                render={<NavLink to={`/farm/${b_id_farm}/${calendar}/grazing/plan`} />}
              >
                <Sparkles className="text-primary h-3.5 w-3.5" />
                Graslandgebruiksysteem planner
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                nativeButton={false}
                render={<NavLink to={`/farm/${b_id_farm}/${calendar}/atlas/grazing`} />}
              >
                <Compass className="text-primary h-3.5 w-3.5" />
                Beweiding op de kaart
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                nativeButton={false}
                render={<NavLink to={`/farm/${b_id_farm}/${calendar}/grazing/insights`} />}
              >
                <ChartColumn className="text-primary h-3.5 w-3.5" />
                Weidegang
              </Button>
              {farmWritePermission && hasGrassland && (
                <>
                  <FieldPickerButton
                    label="Maaisnede toevoegen"
                    icon={<Wheat className="text-primary h-3.5 w-3.5" />}
                    fields={matrix.fields}
                    onPick={(b_id) =>
                      openSheet({ type: "harvest", context: { b_id, date: defaultDate } })
                    }
                  />
                  <FieldPickerButton
                    label="Bemesting toevoegen"
                    icon={<Shovel className="text-primary h-3.5 w-3.5" />}
                    fields={matrix.fields}
                    onPick={(b_id) =>
                      openSheet({ type: "fertilizer", context: { b_id, date: defaultDate } })
                    }
                  />
                </>
              )}
              {farmWritePermission && (
                <Button
                  size="sm"
                  onClick={() => setIsQuickEntryOpen(true)}
                  disabled={!hasKoppels || !hasGrassland}
                  className="gap-1.5 text-xs font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Koeien naar buiten
                </Button>
              )}
            </div>
          }
        />

        <FarmContent>
          <div className="space-y-6">
            {!hasKoppels ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <Warehouse className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">Nog geen melkvee aanwezig</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Voeg je eerste koppel toe om te starten met de beweidingskalender.
                </p>
                <Button
                  className="mt-6 gap-1.5"
                  nativeButton={false}
                  render={<NavLink to={`/farm/${b_id_farm}/${calendar}/livestock/new`} />}
                >
                  <Plus className="h-4 w-4" />
                  Melkvee toevoegen
                </Button>
              </div>
            ) : !hasGrassland ? (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <SquareArrowRightExit className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="mt-4 text-lg font-semibold">Geen graslandpercelen gevonden</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  Er zijn voor dit kalenderjaar geen percelen met graslandteelt geregistreerd in het
                  bouwplan.
                </p>
                <Button
                  className="mt-6 gap-1.5"
                  nativeButton={false}
                  render={<NavLink to={`/farm/${b_id_farm}/${calendar}/rotation`} />}
                >
                  Naar Bouwplan
                </Button>
              </div>
            ) : (
              <CalendarGrid
                matrix={matrix}
                b_id_farm={b_id_farm}
                calendar={calendar}
                canWrite={farmWritePermission}
                onSheetRequest={openSheet}
              />
            )}
          </div>
        </FarmContent>
      </main>

      {/* Quick Entry Sheet */}
      <QuickEntrySheet
        open={isQuickEntryOpen}
        onOpenChange={setIsQuickEntryOpen}
        b_id_farm={b_id_farm}
        calendar={calendar}
        herds={matrix.herds}
        fields={matrix.fields}
        openGrazings={openGrazings}
        canWrite={farmWritePermission}
      />

      {/* Mowing and fertilizing, with the forms of the Tijdlijn */}
      <AddEventSheet
        request={sheetRequest}
        onOpenChange={(open) => {
          if (!open) openSheet(undefined)
        }}
        b_id_farm={b_id_farm}
        calendar={calendar}
        lastCultivationAvailabilityYear={lastCultivationAvailabilityYear}
        canModify={farmWritePermission}
        fields={grasslandFields}
        fertilizerOptions={fertilizerOptions}
        cultivationOptions={[]}
        // This page is an index route; React Router only adds "?index" itself without an action
        formAction="?index"
      />
    </SidebarInset>
  )
}

/** A toolbar button that asks for the grassland field to record something on. */
function FieldPickerButton({
  label,
  icon,
  fields,
  onPick,
}: {
  label: string
  icon: ReactNode
  fields: Array<{ b_id: string; b_name: string }>
  onPick: (b_id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="gap-1.5 text-xs" />}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Kies een perceel</DropdownMenuLabel>
          {fields.map((field) => (
            <DropdownMenuItem key={field.b_id} onClick={() => onPick(field.b_id)}>
              {field.b_name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
