import {
  addCultivation,
  checkPermission,
  getCultivationsFromCatalogue,
  getFarms,
  getFertilizerApplication,
  getSoilAnalysis,
  getSoilImages,
  removeCultivation,
  removeSoilAnalysis,
  removeSoilImage,
  updateCultivation,
  updateFertilizerApplication,
  updateHarvest,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-core"
import { getLastCultivationAvailabilityYear } from "@nmi-agro/fdm-data"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { data, type MetaFunction, useActionData, useLoaderData, useParams } from "react-router"
import { dataWithError, dataWithSuccess } from "remix-toast"
import z from "zod"
import type { Range } from "@/app/components/kibo-ui/gantt"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type {
  TimelineFilters,
  TimelineGanttViewHandle,
} from "~/components/blocks/timeline/gantt-view"
import type { HelpHandle } from "~/lib/manual/help-targets"
import { CultivationAddFormSchema } from "~/components/blocks/cultivation/schema"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddEventSheet } from "~/components/blocks/timeline/add-event-sheet"
import { TimelineGanttView } from "~/components/blocks/timeline/gantt-view"
import { TimelineMobileView } from "~/components/blocks/timeline/mobile-view"
import { TimelineToolbar } from "~/components/blocks/timeline/toolbar"
import { PageContainer } from "~/components/custom/page-container"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { useAnalytics } from "~/hooks/use-analytics"
import { useIsMobile } from "~/hooks/use-mobile"
import { deleteObject } from "~/integrations/gcs.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { endMonth, getTimeframeForYears, startMonth } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError, isToastResponse } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import {
  FIELD_EVENT_SCHEMAS,
  getFertilizerOptions,
  handleFieldEvent,
  isFieldEvent,
} from "~/lib/field-events.server"
import { extractFormValuesFromRequest } from "~/lib/form"
import { fetchTimelineFields } from "~/lib/timeline-data.server"
import { useCalendarJump, useCalendarStore } from "~/store/calendar"
import type { Route } from "./+types/farm.$b_id_farm.$calendar.timeline"

// The years the timeline can ever request must stay within the app's supported Calendar range
// (see ~/lib/calendar's getCalendarSelection), so scrolling can never ask for a year that isn't a
// selectable calendar year anywhere else in the app.
const TIMELINE_START_YEAR = startMonth.getFullYear()
const TIMELINE_END_YEAR = endMonth.getFullYear()

export const handle: HelpHandle = { help: "tijdlijn" }

export const meta: MetaFunction = () => {
  return [
    { title: `Tijdlijn | ${clientConfig.name}` },
    {
      name: "description",
      content:
        "Bekijk in één overzicht alle gewassen, bemestingen, oogsten en bodemanalyses van je bedrijf op een tijdlijn.",
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

    const calendar = params.calendar
    if (!calendar) {
      throw data("invalid: calendar", {
        status: 400,
        statusText: "invalid: calendar",
      })
    }

    const session = await getSession(request)

    await checkPermission(fdm, "farm", "read", b_id_farm, session.principal_id, "timeline")

    const farmWritePermission = await checkPermission(
      fdm,
      "farm",
      "write",
      b_id_farm,
      session.principal_id,
      "timeline",
      false,
    )

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
    const [timelineFields, fertilizerOptions, cultivationsCatalogue] = await Promise.all([
      fetchTimelineFields(
        session.principal_id,
        b_id_farm,
        getTimeframeForYears(TIMELINE_START_YEAR, TIMELINE_END_YEAR),
      ),
      getFertilizerOptions(session.principal_id, b_id_farm),
      getCultivationsFromCatalogue(fdm, session.principal_id, b_id_farm),
    ])

    // Map catalogue cultivations to options for the add-cultivation combobox
    const cultivationOptions = cultivationsCatalogue.map((cultivation) => {
      const catalogueCode = cultivation.b_lu_catalogue.split("_")[1]
      return {
        value: cultivation.b_lu_catalogue,
        label: catalogueCode
          ? `${cultivation.b_lu_name} (${catalogueCode})`
          : cultivation.b_lu_name,
        b_lu_ya: cultivation.b_lu_ya,
      }
    })

    return {
      b_id_farm,
      calendar,
      lastCultivationAvailabilityYear: await getLastCultivationAvailabilityYear(),
      farmWritePermission,
      farmOptions,
      fields: timelineFields,
      fertilizerOptions: fertilizerOptions,
      cultivationOptions: cultivationOptions,
    }
  } catch (error) {
    const normalized = handleLoaderError(error)
    throw normalized ?? error
  }
}

const dateField = z.preprocess(
  (val) => (typeof val === "string" ? new Date(val) : val),
  z.date({
    error: (issue) => (issue.input === undefined ? "Datum is verplicht" : "Datum is ongeldig"),
  }),
)

const ActionSchema = z.discriminatedUnion("intent", [
  CultivationAddFormSchema.safeExtend({
    intent: z.literal("add_cultivation"),
  }),
  CultivationAddFormSchema.safeExtend({
    intent: z.literal("update_cultivation"),
  }),
  ...FIELD_EVENT_SCHEMAS,
  z.object({
    intent: z.literal("update_fertilizer_date"),
    p_app_id: z.string(),
    p_app_date: dateField,
  }),
  z.object({
    intent: z.literal("update_harvest_date"),
    b_id_harvesting: z.string(),
    b_lu_harvest_date: dateField,
  }),
  z.object({
    intent: z.literal("update_soil_analysis_date"),
    a_id: z.string(),
    b_sampling_date: dateField,
  }),
  z.object({
    intent: z.literal("remove_cultivation"),
    b_lu: z.string(),
  }),
  z.object({
    intent: z.literal("remove_soil_analysis"),
    a_id: z.string(),
  }),
])
export async function action({ request, params }: Route.LoaderArgs) {
  try {
    const session = await getSession(request)

    let formValues: z.infer<typeof ActionSchema>
    try {
      formValues = await extractFormValuesFromRequest(request, ActionSchema)
    } catch (err) {
      const validationErrors = isToastResponse(err)
        ? (err.data as { validationErrors?: unknown } | null)?.validationErrors
        : undefined
      if (Array.isArray(validationErrors)) {
        return dataWithError({ errors: validationErrors }, "De invoer is ongeldig")
      }
      throw err
    }

    const intentsWithBId: (typeof formValues.intent)[] = ["add_cultivation", "add_fertilizer"]

    if (
      intentsWithBId.includes(formValues.intent) &&
      (!("b_id" in formValues) || !formValues.b_id)
    ) {
      console.error(`Timeline route didn't submit b_id. Intent was ${formValues.intent}`)
      return dataWithError(null, "Er is iets fout gegaan met jouw invoer.")
    }

    if (formValues.intent === "update_single_harvest" && !formValues.b_id_harvesting) {
      console.error(`Timeline route didn't submit b_id_harvesting. Intent was ${formValues.intent}`)
      return dataWithError(null, "Er is iets fout gegaan met jouw invoer.")
    }

    if (
      (formValues.intent === "single_harvest" ||
        formValues.intent === "update_single_harvest" ||
        formValues.intent === "update_cultivation") &&
      !formValues.b_lu
    ) {
      console.error(`Timeline route didn't submit b_lu. Intent was ${formValues.intent}`)
      return dataWithError(null, "Er is iets fout gegaan met jouw invoer.")
    }

    if (formValues.intent === "add_cultivation") {
      const { b_lu_catalogue, b_id, b_lu_start, b_lu_end } = formValues
      await addCultivation(
        fdm,
        session.principal_id,
        b_lu_catalogue,
        b_id ?? "",
        b_lu_start,
        b_lu_end,
      )

      captureEvent(session.principal_id, "cultivation_added", {
        b_id_farm: params.b_id_farm,
        b_id,
        b_lu_catalogue,
        calendar: String(params.calendar),
      })

      return dataWithSuccess({ closeSheet: true }, { message: "Gewas is toegevoegd! 🎉" })
    }

    if (formValues.intent === "update_cultivation") {
      const { b_lu, b_lu_start, b_lu_end } = formValues
      await updateCultivation(
        fdm,
        session.principal_id,
        b_lu ?? "",
        undefined,
        b_lu_start,
        b_lu_end,
      )

      return dataWithSuccess({ closeSheet: true }, { message: "Gewas is bijgewerkt." })
    }

    // Harvests and fertilizer applications, shared with the grazing calendar
    if (isFieldEvent(formValues)) {
      if (!params.b_id_farm) {
        throw new Error("Farm ID is missing")
      }
      return await handleFieldEvent(formValues, {
        principal_id: session.principal_id,
        b_id_farm: params.b_id_farm,
        calendar: String(params.calendar),
        source: "rotation_table",
      })
    }

    if (formValues.intent === "update_fertilizer_date") {
      const original = await getFertilizerApplication(
        fdm,
        session.principal_id,
        formValues.p_app_id,
      )
      if (!original) {
        return dataWithError(null, "Bemesting is niet gevonden.")
      }

      await updateFertilizerApplication(
        fdm,
        session.principal_id,
        formValues.p_app_id,
        original.p_id,
        // Keep the stored amount: moving an application must not re-validate an older amount
        null,
        original.p_app_method,
        formValues.p_app_date,
      )

      return dataWithSuccess(
        { moved: true },
        {
          message: `Bemesting verplaatst naar ${format(formValues.p_app_date, "d MMMM", { locale: nl })}`,
        },
      )
    }

    if (formValues.intent === "update_harvest_date") {
      await updateHarvest(
        fdm,
        session.principal_id,
        formValues.b_id_harvesting,
        formValues.b_lu_harvest_date,
      )

      return dataWithSuccess(
        { moved: true },
        {
          message: `Oogst verplaatst naar ${format(formValues.b_lu_harvest_date, "d MMMM", { locale: nl })}`,
        },
      )
    }

    if (formValues.intent === "update_soil_analysis_date") {
      await updateSoilAnalysis(fdm, session.principal_id, formValues.a_id, {
        b_sampling_date: formValues.b_sampling_date,
      })

      return dataWithSuccess(
        { moved: true },
        {
          message: `Bodemanalyse verplaatst naar ${format(formValues.b_sampling_date, "d MMMM", { locale: nl })}`,
        },
      )
    }

    if (formValues.intent === "remove_soil_analysis") {
      const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, formValues.a_id)
      if (isBcsAnalysis(soilAnalysis)) {
        const images = await getSoilImages(fdm, session.principal_id, soilAnalysis.b_id_sampling)

        // Storage objects are deleted only after the permission check and DB transaction succeed
        await Promise.all(
          images.map((image) =>
            removeSoilImage(fdm, session.principal_id, image.a_id_image, deleteObject),
          ),
        )
      }
      await removeSoilAnalysis(fdm, session.principal_id, formValues.a_id)
      if (soilAnalysis?.a_file_path) {
        await deleteObject(soilAnalysis.a_file_path)
      }

      return dataWithSuccess(null, { message: "Bodemanalyse is verwijderd." })
    }

    if (formValues.intent === "remove_cultivation") {
      await removeCultivation(fdm, session.principal_id, formValues.b_lu)

      return dataWithSuccess({ closeSheet: true }, { message: "Gewas is verwijderd." })
    }
  } catch (err) {
    // extractFormValuesFromRequest already turned validation errors into a toast response
    if (isToastResponse(err)) return err
    return handleActionError(err)
  }
}

/**
 * CSS media query that is assumed to match when the device is landscape.
 */
const LANDSCAPE_QUERY = "(max-width: 1024px) and (orientation: landscape)"

/**
 * Starts listening to window.matchMedia(<landscape CSS query>) if it is available, and calls the passed function
 * whenever the match state changes. Also returns a function that lets the caller stop the
 * listening.
 * @param onChange Callback to call with updates.
 * @returns a function that stops the listening.
 */
function subscribeToLandscapeQuery(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const mql = window.matchMedia(LANDSCAPE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Runs the landscape CSS media query in the browser.
 * @returns whether the query matches.
 */
function getLandscapeQuerySnapshot() {
  return window.matchMedia(LANDSCAPE_QUERY).matches
}

/**
 * "Runs" the landscape CSS media query if this is not the browser.
 * @returns just false, since don't have a device that could be landscape.
 */
function getLandscapeQueryServerSnapshot() {
  return false
}

export default function TimelinePage() {
  const loaderData = useLoaderData<typeof loader>()
  const { calendar } = useParams()
  const isMobile = useIsMobile()
  const { capture } = useAnalytics()
  const actionData = useActionData()
  const storedCalendar = useCalendarStore((store) => store.calendar)

  // We don't have access to the screen on the server and assume the device is not landscape.
  // We use useSyncExternalStore to also render client-side once with this placeholder value
  // so we don't get hydration errors.
  const isLandscape = useSyncExternalStore(
    subscribeToLandscapeQuery,
    getLandscapeQuerySnapshot,
    getLandscapeQueryServerSnapshot,
  )

  const showMobileView = isMobile || isLandscape
  const showMobileViewRef = useRef(showMobileView)
  useEffect(() => {
    showMobileViewRef.current = showMobileView
  }, [showMobileView])

  useEffect(() => {
    if (typeof window === "undefined") return
    const id = window.requestAnimationFrame(() => {
      capture("timeline_viewed", {
        b_id_farm: loaderData.b_id_farm,
        calendar,
        view: showMobileViewRef.current ? "mobile" : "gantt",
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [capture, loaderData.b_id_farm, calendar])

  const ganttRef = useRef<TimelineGanttViewHandle>(null)
  const registerJumpToYear = useCalendarJump((state) => state.registerJumpToYear)

  const [range, setRange] = useState<Range>("monthly")
  const [filters, setFilters] = useState<TimelineFilters>({
    showBufferStrips: false,
    showCultivations: true,
    showFertilizers: true,
    showHarvests: true,
    showSoilSamplings: true,
    showFutureEvents: false,
  })

  // The sheet request, tagged with the actionData it was opened under. Closed by the user
  // (setSheetState(undefined)) or by a *newer* actionData reporting closeSheet (see sheetRequest below).
  const [sheetState, setSheetState] = useState<
    { request: AddEventSheetRequest; openedWithActionData: unknown } | undefined
  >()
  const [undo, setUndo] = useState<{ run: () => void } | null>(null)
  const handleUndoChange = useCallback(
    (run: (() => void) | null) => setUndo(run ? { run } : null),
    [],
  )

  const currentFarmName =
    loaderData.farmOptions.find((farm) => farm.b_id_farm === loaderData.b_id_farm)?.b_name_farm ??
    ""

  const parsedCalendarParam = Number(calendar)
  const calendarYear = Number.isNaN(parsedCalendarParam)
    ? Number(storedCalendar)
    : parsedCalendarParam

  const fertilizerTypeById = useMemo(
    () => new Map(loaderData.fertilizerOptions.map((f) => [f.value, f])),
    [loaderData.fertilizerOptions],
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

  // Close the sheet once the action that was submitted while it was open succeeds.
  if (
    sheetState &&
    actionData !== sheetState.openedWithActionData &&
    (actionData as { closeSheet?: boolean } | undefined)?.closeSheet
  ) {
    setSheetState(undefined)
  }

  const sheetRequest = sheetState?.request

  function setSheetRequest(request: AddEventSheetRequest | undefined) {
    setSheetState(request ? { request, openedWithActionData: actionData } : undefined)
  }

  const action = {
    to: `/farm/${loaderData.b_id_farm}`,
    label: "Terug naar bedrijf",
    disabled: false,
  }

  return (
    <PageContainer>
      <Header action={action}>
        <HeaderFarm b_id_farm={loaderData.b_id_farm} farmOptions={loaderData.farmOptions} />
        <BreadcrumbSeparator />
        <BreadcrumbItem className="hidden md:block">Tijdlijn</BreadcrumbItem>
      </Header>
      <div className="min-w-0">
        {showMobileView ? (
          <>
            <FarmTitle
              help="tijdlijn"
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
              canModify={loaderData.farmWritePermission}
              onRequest={setSheetRequest}
            />
          </>
        ) : (
          <>
            <FarmTitle
              help="tijdlijn"
              title={`Tijdlijn van ${currentFarmName}`}
              description="Overzicht van alle gewassen, bemestingen, oogsten en bodemanalyses over de percelen."
              rightNode={
                <TimelineToolbar
                  filters={filters}
                  onFiltersChange={setFilters}
                  onJumpToToday={() => ganttRef.current?.scrollToToday()}
                  onUndo={undo?.run}
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
                canModify={loaderData.farmWritePermission}
                fertilizerTypeById={fertilizerTypeById}
                fields={loaderData.fields}
                filters={filters}
                onFiltersChange={setFilters}
                onSheetRequest={setSheetRequest}
                onUndoChange={handleUndoChange}
                range={range}
                ref={ganttRef}
              />
            </FarmContent>
          </>
        )}
      </div>
      <AddEventSheet
        b_id_farm={loaderData.b_id_farm}
        calendar={loaderData.calendar}
        lastCultivationAvailabilityYear={loaderData.lastCultivationAvailabilityYear}
        canModify={loaderData.farmWritePermission}
        fertilizerOptions={loaderData.fertilizerOptions}
        cultivationOptions={loaderData.cultivationOptions}
        fields={loaderData.fields}
        onOpenChange={(open) => {
          if (!open) {
            setSheetRequest(undefined)
            ganttRef.current?.remount()
          }
        }}
        request={sheetRequest}
      />
    </PageContainer>
  )
}
