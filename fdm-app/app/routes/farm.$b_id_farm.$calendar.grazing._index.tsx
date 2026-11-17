import { checkPermission, getFarm, getFarms } from "@nmi-agro/fdm-core"
import { getLastCultivationAvailabilityYear } from "@nmi-agro/fdm-data"
import { format } from "date-fns"
import {
  ChartColumn,
  Compass,
  Plus,
  Shovel,
  Sparkles,
  SquareArrowRightExit,
  Warehouse,
  Wheat,
} from "lucide-react"
import { useState } from "react"
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
  NavLink,
  useActionData,
  useLoaderData,
} from "react-router"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { CalendarGrid } from "~/components/blocks/grazing/calendar-grid"
import { FieldPickerButton } from "~/components/blocks/grazing/field-picker-button"
import { GrazingPopover } from "~/components/blocks/grazing/grazing-popover"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddEventSheet } from "~/components/blocks/timeline/add-event-sheet"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
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
import { handleGrazingEvent } from "~/lib/grazing-events.server"
import { defaultMapDay } from "~/lib/grazing-map"
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
 * The view of the calendar from the URL: `?weergave=dag` shows every day of the grazing season,
 * anything else the weeks of the year.
 */
function getCalendarView(searchParams: URLSearchParams): GrazingCalendarView {
  return searchParams.get("weergave") === "dag" ? { kind: "day" } : { kind: "week" }
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

    // The grazing dialog, shared with the Atlas layer and the field's grazing page
    return await handleGrazingEvent(formData, { principal_id: session.principal_id, calendar })
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
    grasslandFields,
    fertilizerOptions,
    lastCultivationAvailabilityYear,
    farmWritePermission,
  } = useLoaderData<typeof loader>()
  const actionData = useActionData<{ closeSheet?: boolean }>()

  // The grazing dialog for a field picked in the toolbar; bumped on every open so it starts fresh
  const [grazingField, setGrazingField] = useState<{
    b_id: string
    b_name: string
    b_area: number
  } | null>(null)
  const [grazingSession, setGrazingSession] = useState(0)

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

  // New grazing, mowing and fertilizing default to today, or the same day in another year
  const today = useToday()
  const defaultDay = today ? defaultMapDay(format(today, "yyyy-MM-dd"), calendarYear) : undefined
  const defaultDate = defaultDay ? new Date(`${defaultDay}T12:00:00`) : undefined

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
                    label="Beweiding toevoegen"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    variant="default"
                    fields={matrix.fields}
                    disabled={!hasKoppels}
                    onPick={(b_id) => {
                      const field = matrix.fields.find((f) => f.b_id === b_id)
                      if (!field) return
                      setGrazingSession((s) => s + 1)
                      setGrazingField({ b_id, b_name: field.b_name, b_area: field.b_area })
                    }}
                  />
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

      {/* The grazing dialog, the same as from a calendar cell */}
      <GrazingPopover
        key={grazingSession}
        open={grazingField !== null}
        onOpenChange={(open) => {
          if (!open) setGrazingField(null)
        }}
        b_id_farm={b_id_farm}
        calendar={calendar}
        field={grazingField}
        initialStartDate={defaultDay}
        initialEndDate={defaultDay}
        herds={matrix.herds}
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
