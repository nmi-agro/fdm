import type { AppAmountUnit } from "@nmi-agro/fdm-core"
import { ApplicationMethods } from "@nmi-agro/fdm-data"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useNavigation } from "react-router"
import { TimelineHarvestParametersResult } from "@/app/routes/farm.$b_id_farm.$calendar.timeline.harvestable_analysis.$b_lu_catalogue"
import { CultivationAddForm } from "~/components/blocks/cultivation/form-add"
import { FertilizerApplicationForm } from "~/components/blocks/fertilizer-applications/form"
import {
  FormSchema as FertilizerApplicationFormSchema,
  type FormSchemaPartial as FertilizerApplicationFormSchemaPartial,
} from "~/components/blocks/fertilizer-applications/formschema"
import { HarvestForm } from "~/components/blocks/harvest/form"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import type { AddEventSheetRequest } from "./add-event-types"
import { findActiveCultivationForDate, type TimelineField } from "./gantt-view"

const SHEET_TITLES: Record<AddEventSheetRequest["type"], string> = {
  fertilizer: "Bemesting toevoegen",
  harvest: "Oogst registreren",
  "cultivation-start": "Gewas starten",
  "cultivation-end": "Gewas beëindigen",
}

/**
 * The right-side Sheet that hosts the quick-add forms. Every submission targets an existing
 * route action (fertilizer/harvest/cultivation create or update) — there's no new backend code
 * here — so, unlike a typical embedded form, submitting one of these forms navigates the browser
 * to that action's own page (its normal, already-existing behaviour) rather than staying on the
 * timeline. The Sheet only exists to get the user to a prefilled form in as few clicks as
 * possible; closing it manually (without submitting) simply discards the quick-add attempt.
 */
export function AddEventSheet({
  request,
  onOpenChange,
  b_id_farm,
  calendar,
  fields,
  fertilizerOptions,
  cultivationOptions,
}: {
  request: AddEventSheetRequest | undefined
  onOpenChange: (open: boolean) => void
  b_id_farm: string
  calendar: string
  fields: TimelineField[]
  fertilizerOptions: {
    value: string
    label: string
    p_app_amount_unit: AppAmountUnit
    applicationMethodOptions: { value: ApplicationMethods; label: string }[]
  }[]
  cultivationOptions: { value: string; label: string }[]
}) {
  const open = !!request
  const field = request ? fields.find((f) => f.b_id === request.context.b_id) : undefined
  const navigation = useNavigation()

  const cultivation = useMemo(() => {
    if (!request || !field) return undefined
    if (request.context.b_lu) {
      return field.cultivations.find((c) => c.b_lu === request.context.b_lu)
    }
    return findActiveCultivationForDate(
      field.cultivations,
      request.context.date,
      new Date(8640000000000000),
    )
  }, [request, field])

  const [loadedHarvestableAnalysis, setLoadedHarvestableAnalysis] = useState<
    Partial<TimelineHarvestParametersResult>
  >({})

  const harvestParametersAbortControllerRef = useRef<AbortController>(null)
  const [areHarvestParametersLoading, loadHarvestParameters] = useTransition()

  // Load the example harvestable analysis when the request type "harvest" and b_lu_catalogue changes
  useEffect(() => {
    harvestParametersAbortControllerRef.current?.abort()
    if (cultivation && request?.type === "harvest") {
      const abortController = new AbortController()
      harvestParametersAbortControllerRef.current = abortController
      loadHarvestParameters(() => {
        return (async () => {
          const response = await fetch(
            `/farm/${b_id_farm}/${calendar}/timeline/harvestable_analysis/${cultivation?.b_lu_catalogue}`,
            { signal: abortController.signal },
          )
          if (response.ok) {
            const data = await response.json()
            setLoadedHarvestableAnalysis(data)
          } else {
            console.error(`Harvestable analysis endpoint returned status ${response.status}.`)
          }
        })().catch((err) => {
          if (err instanceof Error && err.name === "AbortError") {
            return
          }
          console.error(err)
          setLoadedHarvestableAnalysis({})
          return
        })
      })
    }
  }, [cultivation?.b_lu_catalogue])

  // Abort any fetches on unmount. This will also end the transition if it was ongoing.
  useEffect(() => {
    return () => {
      harvestParametersAbortControllerRef.current?.abort()
    }
  }, [])

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{request ? SHEET_TITLES[request.type] : ""}</SheetTitle>
          <SheetDescription>
            {field ? `Perceel: ${field.b_name}` : "Kies eerst een perceel"}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {request && field && request.type === "fertilizer" ? (
            <FertilizerApplicationForm
              intent="add_fertilizer"
              b_id={field.b_id}
              action={"#"}
              b_id_farm={b_id_farm}
              b_id_or_b_lu_catalogue={field.b_id}
              fertilizerApplication={{ p_app_date: request.context.date }}
              options={fertilizerOptions}
              navigation={navigation as never}
              fieldsClassName="md:grid-cols-1"
              schema={
                FertilizerApplicationFormSchema as unknown as typeof FertilizerApplicationFormSchemaPartial
              }
            />
          ) : null}
          {request && field && request.type === "harvest" ? (
            cultivation ? (
              <HarvestForm
                key={loadedHarvestableAnalysis.b_lu_catalogue}
                editable={!areHarvestParametersLoading}
                allowBatch={false}
                b_date_harvest_default={loadedHarvestableAnalysis.b_date_harvest_default}
                b_lu={cultivation.b_lu}
                b_lu_cp={loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_cp ?? undefined}
                b_lu_croprotation={cultivation.b_lu_croprotation ?? undefined}
                b_lu_dm={loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_dm ?? undefined}
                b_lu_end={cultivation.b_lu_end}
                b_lu_harvest_date={request.context.date}
                b_lu_harvestable={cultivation.b_lu_harvestable}
                b_lu_moist={
                  loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_moist ?? undefined
                }
                b_lu_n_harvestable={
                  loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_n_harvestable ??
                  undefined
                }
                b_lu_start={cultivation.b_lu_start}
                b_lu_tarra={
                  loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_tarra ?? undefined
                }
                b_lu_uww={loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_uww ?? undefined}
                b_lu_yield={
                  loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_yield ?? undefined
                }
                b_lu_yield_bruto={
                  loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_yield_bruto ?? undefined
                }
                b_lu_yield_fresh={
                  loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_yield_fresh ?? undefined
                }
                harvestParameters={loadedHarvestableAnalysis.harvestParameters ?? []}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Er is geen actief gewas op dit perceel voor deze datum.
              </p>
            )
          ) : null}
          {request &&
          field &&
          (request.type === "cultivation-start" || request.type === "cultivation-end") ? (
            <CultivationAddForm
              intent={cultivation ? "update_cultivation" : "add_cultivation"}
              b_id={field.b_id}
              b_lu={cultivation?.b_lu}
              defaultValues={{
                b_lu_catalogue: cultivation ? cultivation.b_lu_catalogue : "",
                b_lu_start:
                  request.type === "cultivation-start"
                    ? request.context.date
                    : (cultivation?.b_lu_start ?? new Date()),
                b_lu_end:
                  request.type === "cultivation-end"
                    ? request.context.date
                    : (cultivation?.b_lu_end ?? undefined),
              }}
              options={cultivationOptions}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
