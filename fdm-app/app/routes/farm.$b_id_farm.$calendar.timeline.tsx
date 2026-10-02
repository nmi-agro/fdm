import {
  addCultivation,
  addFertilizerApplication,
  addHarvest,
  checkPermission,
  getCultivation,
  getCultivationsFromCatalogue,
  getFarms,
  getFertilizerApplication,
  getFertilizerParametersDescription,
  getFertilizers,
  getHarvests,
  getParametersForHarvestCat,
  getSoilAnalysis,
  HarvestParameters,
  removeCultivation,
  removeFertilizerApplication,
  removeHarvest,
  removeSoilAnalysis,
  updateCultivation,
  updateFertilizerApplication,
  updateHarvest,
} from "@nmi-agro/fdm-core"
import { ApplicationMethods } from "@nmi-agro/fdm-data"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { data, type MetaFunction, useActionData, useLoaderData, useParams } from "react-router"
import { dataWithError, dataWithSuccess, dataWithWarning } from "remix-toast"
import z from "zod"
import type { Range } from "@/app/components/kibo-ui/gantt"
import type { AddEventSheetRequest } from "~/components/blocks/timeline/add-event-types"
import type {
  TimelineFilters,
  TimelineGanttViewHandle,
} from "~/components/blocks/timeline/gantt-view"
import { CultivationAddFormSchema } from "~/components/blocks/cultivation/schema"
import { FarmContent } from "~/components/blocks/farm/farm-content"
import { FarmTitle } from "~/components/blocks/farm/farm-title"
import {
  FormSchema as FertilizerApplicationFormSchema,
  FormSchemaModify as FertilizerApplicationFormSchemaModify,
} from "~/components/blocks/fertilizer-applications/formschema"
import { getHarvestParameterLabel } from "~/components/blocks/harvest/parameters"
import { FormSchema as HarvestFormSchema } from "~/components/blocks/harvest/schema"
import { getEffectiveHarvestable, getHarvestTerm } from "~/components/blocks/harvest/utils"
import { Header } from "~/components/blocks/header/base"
import { HeaderFarm } from "~/components/blocks/header/farm"
import { AddEventSheet } from "~/components/blocks/timeline/add-event-sheet"
import { TimelineGanttView } from "~/components/blocks/timeline/gantt-view"
import { TimelineMobileView } from "~/components/blocks/timeline/mobile-view"
import { TimelineToolbar } from "~/components/blocks/timeline/toolbar"
import { BreadcrumbItem, BreadcrumbSeparator } from "~/components/ui/breadcrumb"
import { SidebarInset } from "~/components/ui/sidebar"
import { useAnalytics } from "~/hooks/use-analytics"
import { useIsMobile } from "~/hooks/use-mobile"
import { deleteObject } from "~/integrations/gcs.server"
import { captureEvent } from "~/lib/analytics.server"
import { getSession } from "~/lib/auth.server"
import { isBcsAnalysis } from "~/lib/bcs"
import { endMonth, getTimeframeForYears, startMonth } from "~/lib/calendar"
import { clientConfig } from "~/lib/config"
import { handleActionError, handleLoaderError } from "~/lib/error"
import { fdm } from "~/lib/fdm.server"
import { extractFormValuesFromRequest } from "~/lib/form"
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
    const [timelineFields, fertilizers, cultivationCatalogue] = await Promise.all([
      fetchTimelineFields(
        session.principal_id,
        b_id_farm,
        getTimeframeForYears(TIMELINE_START_YEAR, TIMELINE_END_YEAR),
      ),
      getFertilizers(fdm, session.principal_id, b_id_farm),
      getCultivationsFromCatalogue(fdm, session.principal_id, b_id_farm),
    ])

    const fertilizerParameterDescription = getFertilizerParametersDescription()
    const applicationMethods = fertilizerParameterDescription.find(
      (x: { parameter: string }) => x.parameter === "p_app_method_options",
    )
    if (!applicationMethods) throw new Error("Parameter metadata missing")
    const applicationMethodOptions = (applicationMethods.options ?? [])
      .filter(
        (option): option is { value: ApplicationMethods; label: string } => option.value !== null,
      )
      .map((option) => ({
        value: option.value,
        label: option.label,
      }))

    const fertilizerOptions = fertilizers.map((fertilizer) => ({
      value: fertilizer.p_id,
      label: fertilizer.p_name_nl ?? "",
      p_type: fertilizer.p_type,
      p_type_rvo: fertilizer.p_type_rvo,
      applicationMethodOptions: (fertilizer.p_app_method_options ?? [])
        .map((opt) => applicationMethodOptions.find((x) => x.value === opt))
        .filter(
          (
            option,
          ): option is {
            value: ApplicationMethods
            label: string
          } => option !== undefined,
        ),
      p_app_amount_unit: fertilizer.p_app_amount_unit,
    }))

    return {
      b_id_farm,
      calendar,
      farmWritePermission,
      farmOptions,
      fields: timelineFields,
      fertilizerOptions: fertilizerOptions,
      cultivationOptions: cultivationCatalogue.map((c) => ({
        value: c.b_lu_catalogue,
        label: c.b_lu_name,
      })),
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
  HarvestFormSchema.safeExtend({ intent: z.literal("single_harvest") }),
  HarvestFormSchema.safeExtend({ intent: z.literal("update_single_harvest") }),
  FertilizerApplicationFormSchema.safeExtend({
    intent: z.literal("add_fertilizer"),
  }),
  FertilizerApplicationFormSchemaModify.safeExtend({
    intent: z.literal("update_fertilizer"),
  }),
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
    intent: z.literal("remove_cultivation"),
    b_lu: z.string(),
  }),
  z.object({
    intent: z.literal("remove_harvest"),
    b_id_harvesting: z.string(),
  }),
  z.object({
    intent: z.literal("remove_fertilizer"),
    p_app_id: z.string(),
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
      const warnings = ((err as any)?.data as any)?.warning
      if (typeof warnings === "string") {
        try {
          const zodErrors = JSON.parse(warnings)
          return dataWithError({ errors: zodErrors }, "De invoer is ongeldig")
          // oxlint-disable-next-line no-unused-vars We go the default error handling route if we were weong by assuming the warning contains the stringified Zod errors.
        } catch (_warningParseError) {}
      }
      throw err
    }

    const intentsWithoutBId: (typeof formValues.intent)[] = [
      "single_harvest",
      "update_single_harvest",
      "update_fertilizer_date",
      "update_harvest_date",
      "remove_cultivation",
      "remove_harvest",
      "remove_fertilizer",
      "remove_soil_analysis",
    ]
    if (
      !intentsWithoutBId.includes(formValues.intent) &&
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

    if (formValues.intent === "add_fertilizer") {
      const { b_id_farm, calendar } = params
      if (!b_id_farm) {
        throw new Error("Farm ID is missing")
      }

      await addFertilizerApplication(
        fdm,
        session.principal_id,
        formValues.b_id ?? "",
        formValues.p_id,
        formValues.p_app_amount_display,
        formValues.p_app_method,
        formValues.p_app_date,
      )

      captureEvent(session.principal_id, "fertilizer_application_added", {
        b_id_farm,
        b_id: formValues.b_id,
        p_id: formValues.p_id,
        calendar: String(calendar),
        source: "rotation_table",
      })

      return dataWithSuccess(
        { closeSheet: true },
        {
          message: `Bemesting succesvol toegevoegd aan het perceel.`,
        },
      )
    }

    if (formValues.intent === "update_fertilizer") {
      const { b_id_farm } = params
      if (!b_id_farm) {
        throw new Error("Farm ID is missing")
      }

      await updateFertilizerApplication(
        fdm,
        session.principal_id,
        formValues.p_app_id,
        formValues.p_id,
        formValues.p_app_amount_display,
        formValues.p_app_method,
        formValues.p_app_date,
      )

      return dataWithSuccess(
        { closeSheet: true },
        {
          message: `Bemesting succesvol bijgewerkt.`,
        },
      )
    }

    if (formValues.intent === "single_harvest") {
      const targetCultivationInstance = await getCultivation(
        fdm,
        session.principal_id,
        formValues.b_lu ?? "",
      )

      const termCapitalizedSingular = getHarvestTerm(
        targetCultivationInstance.b_lu_croprotation,
        false,
        targetCultivationInstance.b_lu_harvestable,
        true,
      )

      // Get required harvest parameters for the cultivation's harvest category
      const requiredHarvestParameters = getParametersForHarvestCat(
        targetCultivationInstance.b_lu_harvestcat,
      )

      // Check if all required parameters are present
      const missingParameters: HarvestParameters = []
      for (const param of requiredHarvestParameters) {
        if (
          (formValues as Record<string, any>)[param] === undefined ||
          (formValues as Record<string, any>)[param] === null
        ) {
          missingParameters.push(param)
        }
      }

      const missingParameterLabels = missingParameters.map((param) => {
        return getHarvestParameterLabel(param)
      })

      if (missingParameters.length > 0) {
        return dataWithWarning(
          {
            warning: `Missing required harvest parameters: ${missingParameters.join(", ")}`,
          },
          `Voor de volgende parameters ontbreekt een waarde: ${missingParameterLabels.join(", ")}`,
        )
      }

      // Filter form values to include only required parameters for updateHarvest
      const harvestProperties: Record<string, number> = {}
      for (const param of requiredHarvestParameters) {
        if (formValues[param] !== undefined) {
          harvestProperties[param] = formValues[param]
        }
      }

      const effectiveHarvestable = getEffectiveHarvestable(
        targetCultivationInstance.b_lu_harvestable ?? "once",
        targetCultivationInstance.b_lu_croprotation,
      )

      await fdm.transaction(async (tx) => {
        if (effectiveHarvestable === "once") {
          // Check for existing harvests for this specific cultivation instance
          const existingHarvests = await getHarvests(
            tx,
            session.principal_id,
            targetCultivationInstance.b_lu,
          )

          if (existingHarvests.length > 0) {
            // If there are existing harvests, remove them before adding new ones
            for (const harvest of existingHarvests) {
              await removeHarvest(tx, session.principal_id, harvest.b_id_harvesting)
            }
          }
        }

        await addHarvest(
          tx,
          session.principal_id,
          targetCultivationInstance.b_lu,
          formValues.b_lu_harvest_date,
          harvestProperties,
        )
      })

      return dataWithSuccess(
        { closeSheet: true },
        {
          message: `${termCapitalizedSingular} succesvol toegevoegd aan het perceel.`,
        },
      )
    }

    if (formValues.intent === "update_single_harvest") {
      const targetCultivationInstance = await getCultivation(
        fdm,
        session.principal_id,
        formValues.b_lu ?? "",
      )

      const termCapitalizedSingular = getHarvestTerm(
        targetCultivationInstance.b_lu_croprotation,
        false,
        targetCultivationInstance.b_lu_harvestable,
        true,
      )

      if (!formValues.b_lu_harvest_date) {
        const errors = [
          {
            path: "b_lu_harvest_date",
            message: "Selecteer een oogstdatum",
          },
        ]

        throw new Error(JSON.stringify(errors))
      }

      // Get required harvest parameters for the cultivation's harvest category
      const requiredHarvestParameters = getParametersForHarvestCat(
        targetCultivationInstance.b_lu_harvestcat,
      )

      // Check if all required parameters are present
      const missingParameters: HarvestParameters = []
      for (const param of requiredHarvestParameters) {
        if (
          (formValues as Record<string, any>)[param] === undefined ||
          (formValues as Record<string, any>)[param] === null
        ) {
          missingParameters.push(param)
        }
      }

      const missingParameterLabels = missingParameters.map((param) => {
        return getHarvestParameterLabel(param)
      })

      if (missingParameters.length > 0) {
        return dataWithWarning(
          {
            warning: `Missing required harvest parameters: ${missingParameters.join(", ")}`,
          },
          `Voor de volgende parameters ontbreekt een waarde: ${missingParameterLabels.join(", ")}`,
        )
      }

      // Filter form values to include only required parameters for updateHarvest
      const harvestProperties: Record<string, any> = {}
      for (const param of requiredHarvestParameters) {
        if ((formValues as Record<string, any>)[param] !== undefined) {
          harvestProperties[param] = (formValues as Record<string, any>)[param]
        }
      }

      await updateHarvest(
        fdm,
        session.principal_id,
        formValues.b_id_harvesting ?? "",
        formValues.b_lu_harvest_date,
        harvestProperties,
      )

      return dataWithSuccess(
        { closeSheet: true },
        {
          message: `${termCapitalizedSingular} succesvol bijgewerkt aan het perceel.`,
        },
      )
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
        original.p_app_amount_display,
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

    if (formValues.intent === "remove_soil_analysis") {
      const soilAnalysis = await getSoilAnalysis(fdm, session.principal_id, formValues.a_id)
      if (isBcsAnalysis(soilAnalysis)) {
        return dataWithError(null, "Een BodemConditieScore analyse kan niet worden verwijderd.")
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

    if (formValues.intent === "remove_harvest") {
      await removeHarvest(fdm, session.principal_id, formValues.b_id_harvesting)

      return dataWithSuccess({ closeSheet: true }, { message: "Oogst is verwijderd." })
    }

    if (formValues.intent === "remove_fertilizer") {
      await removeFertilizerApplication(fdm, session.principal_id, formValues.p_app_id)

      return dataWithSuccess({ closeSheet: true }, { message: "Bemesting is verwijderd." })
    }
  } catch (err) {
    throw handleActionError(err)
  }
}

export default function TimelinePage() {
  const loaderData = useLoaderData<typeof loader>()
  const { calendar } = useParams()
  const isMobile = useIsMobile()
  const [isLandscape, setIsLandscape] = useState(false)
  const { capture } = useAnalytics()
  const actionData = useActionData()
  const lastActionData = useRef<unknown>(undefined)

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return
    }
    const mql = window.matchMedia("(max-width: 1024px) and (orientation: landscape)")
    const onChange = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches)
    }
    mql.addEventListener("change", onChange)
    setIsLandscape(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

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
  }, [])

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

  const [sheetRequest, setSheetRequest] = useState<AddEventSheetRequest>()
  const [undo, setUndo] = useState<{ run: () => void } | null>(null)
  const handleUndoChange = useCallback(
    (run: (() => void) | null) => setUndo(run ? { run } : null),
    [],
  )

  const currentFarmName =
    loaderData.farmOptions.find((farm) => farm.b_id_farm === loaderData.b_id_farm)?.b_name_farm ??
    ""

  const calendarYear = useMemo(() => {
    const parsed = Number(calendar)
    return Number.isNaN(parsed) ? new Date().getFullYear() : parsed
  }, [calendar])

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

  // Close the sheet if the action succeeds.
  useEffect(() => {
    if (lastActionData.current === actionData) {
      return
    }

    if ((actionData as any)?.closeSheet) {
      setSheetRequest(undefined)
    }

    lastActionData.current = actionData
  }, [actionData])

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
        {showMobileView ? (
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
              canModify={loaderData.farmWritePermission}
              onRequest={setSheetRequest}
            />
          </>
        ) : (
          <>
            <FarmTitle
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
      </main>
      <AddEventSheet
        b_id_farm={loaderData.b_id_farm}
        calendar={loaderData.calendar}
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
    </SidebarInset>
  )
}
