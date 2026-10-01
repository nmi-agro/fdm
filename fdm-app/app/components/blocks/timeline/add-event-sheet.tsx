import type { AppAmountUnit } from "@nmi-agro/fdm-core"
import { ApplicationMethods } from "@nmi-agro/fdm-data"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useFetcher, useNavigation } from "react-router"
import { TimelineHarvestParametersResult } from "@/app/routes/farm.$b_id_farm.$calendar.timeline.harvestable_analysis.$b_lu_catalogue"
import { CultivationAddForm } from "~/components/blocks/cultivation/form-add"
import { FertilizerApplicationForm } from "~/components/blocks/fertilizer-applications/form"
import {
  FormSchema as FertilizerApplicationFormSchema,
  FormSchemaModify as FertilizerApplicationFormSchemaModify,
  type FormSchemaPartial as FertilizerApplicationFormSchemaPartial,
} from "~/components/blocks/fertilizer-applications/formschema"
import { HarvestForm } from "~/components/blocks/harvest/form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet"
import type { AddEventSheetRequest } from "./add-event-types"
import { getHarvestTerm } from "../harvest/utils"
import { findActiveCultivationForDate, type TimelineField } from "./gantt-view"

const SHEET_TITLES: Record<AddEventSheetRequest["type"], string> = {
  "cultivation-edit": "Gewas bewerken",
  "cultivation-end": "Gewas beëindigen",
  "cultivation-add": "Gewas toevoegen",
  fertilizer: "Bemesting toevoegen",
  "fertilizer-edit": "Bemesting bewerken",
  harvest: "Oogst registreren",
  "harvest-edit": "Oogst bewerken",
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
  canModify,
  fields,
  fertilizerOptions,
  cultivationOptions,
}: {
  request: AddEventSheetRequest | undefined
  onOpenChange: (open: boolean) => void
  b_id_farm: string
  calendar: string
  canModify: boolean
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
  const deleteFetcher = useFetcher()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fertilizerApplication = useMemo(() => {
    if (!request || request.type !== "fertilizer-edit" || !field) return undefined
    return field.fertilizerApplications.find((f) => f.p_app_id === request.context.p_app_id)
  }, [request, field])

  const cultivation = useMemo(() => {
    if (!request || !field) return undefined
    if (request.context.b_lu) {
      return field.cultivations.find((c) => c.b_lu === request.context.b_lu)
    }
    if (!request.context.date) {
      return undefined
    }
    return findActiveCultivationForDate(
      field.cultivations,
      request.context.date,
      new Date(8640000000000000),
    )
  }, [request, field])

  const harvest = useMemo(() => {
    if (!request || request.type !== "harvest-edit") return undefined
    return field?.harvests.find((h) => h.b_id_harvesting === request.context.b_id_harvesting)
  }, [field, request])

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
            if (!abortController.signal.aborted) {
              setLoadedHarvestableAnalysis(data)
            }
          } else {
            console.error(`Harvestable analysis endpoint returned status ${response.status}.`)
          }
        })().catch((err) => {
          if (err instanceof Error && err.name === "AbortError") {
            return
          }
          console.error(err)
          if (!abortController.signal.aborted) {
            setLoadedHarvestableAnalysis({})
          }
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

  const isEditRequest = request?.type === "cultivation-edit" || request?.type === "fertilizer-edit"

  const handleConfirmDelete = () => {
    if (!request || !field) return
    if (request.type === "cultivation-edit") {
      const formData = new FormData()
      formData.set("intent", "remove_cultivation")
      formData.set("b_lu", request.context.b_lu)
      void deleteFetcher.submit(formData, { method: "POST" })
    } else if (request.type === "harvest-edit") {
      const formData = new FormData()
      formData.set("intent", "remove_harvest")
      formData.set("b_id_harvesting", request.context.b_id_harvesting)
      void deleteFetcher.submit(formData, {
        method: "POST",
      })
    } else if (request.type === "fertilizer-edit") {
      const formData = new FormData()
      formData.set("intent", "remove_fertilizer")
      formData.set("p_app_id", request.context.p_app_id)
      void deleteFetcher.submit(formData, {
        method: "POST",
      })
    }
    setConfirmingDelete(false)
    onOpenChange(false)
  }

  const lastActionData = useRef<unknown>(null)
  useEffect(() => {
    if (lastActionData.current === deleteFetcher.data) return
    if ((deleteFetcher.data as any)?.closeSheet) {
      onOpenChange(false)
    }
    lastActionData.current = deleteFetcher.data
  })

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {!request
              ? ""
              : request.type === "harvest-edit"
                ? `${getHarvestTerm(cultivation?.b_lu_croprotation, false, cultivation?.b_lu_harvestable, true)} bewerken`
                : request.type === "harvest"
                  ? `${getHarvestTerm(cultivation?.b_lu_croprotation, false, cultivation?.b_lu_harvestable, true)} toevoegen`
                  : SHEET_TITLES[request.type]}
          </SheetTitle>
          <SheetDescription>
            {field ? `Perceel: ${field.b_name}` : "Kies eerst een perceel"}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {request && field && request.type === "fertilizer" ? (
            <FertilizerApplicationForm
              intent="add_fertilizer"
              b_id={field.b_id}
              action="#"
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
              cultivation.b_lu_harvestable === "none" ? (
                <p className="text-muted-foreground text-sm">Dit gewas kan niet geoogst worden.</p>
              ) : (
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
                  b_lu_uww={
                    loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_uww ?? undefined
                  }
                  b_lu_yield={
                    loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_yield ?? undefined
                  }
                  b_lu_yield_bruto={
                    loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_yield_bruto ??
                    undefined
                  }
                  b_lu_yield_fresh={
                    loadedHarvestableAnalysis.harvestParameterDefaults?.b_lu_yield_fresh ??
                    undefined
                  }
                  harvestParameters={loadedHarvestableAnalysis.harvestParameters ?? []}
                />
              )
            ) : (
              <p className="text-muted-foreground text-sm">
                Er is geen actief gewas op dit perceel voor deze datum.
              </p>
            )
          ) : null}
          {request && field && request.type === "cultivation-add" ? (
            <CultivationAddForm
              intent="add_cultivation"
              b_id={field.b_id}
              b_lu={undefined}
              defaultValues={{
                b_lu_catalogue: "",
                b_lu_start: request.context.date ?? new Date(),
                b_lu_end: undefined,
              }}
              options={cultivationOptions}
            />
          ) : null}
          {request && field && request.type === "cultivation-edit" ? (
            <CultivationAddForm
              intent="update_cultivation"
              b_id={field.b_id}
              b_lu={request.context.b_lu}
              defaultValues={{
                b_lu_catalogue: cultivation?.b_lu_catalogue ?? "",
                b_lu_start: cultivation?.b_lu_start ?? new Date(),
                b_lu_end: cultivation?.b_lu_end ?? undefined,
              }}
              options={cultivationOptions}
            />
          ) : null}
          {request && field && request.type === "fertilizer-edit" && fertilizerApplication ? (
            <FertilizerApplicationForm
              intent="update_fertilizer"
              action="#"
              b_id={field.b_id}
              b_id_farm={b_id_farm}
              b_id_or_b_lu_catalogue={field.b_id}
              fertilizerApplication={{
                ...fertilizerApplication,
                p_app_amount_display: fertilizerApplication.p_app_amount_display ?? undefined,
                p_app_method: fertilizerApplication.p_app_method ?? undefined,
              }}
              fieldsClassName="md:grid-cols-1"
              navigation={navigation as never}
              options={fertilizerOptions}
              schema={
                FertilizerApplicationFormSchemaModify as unknown as typeof FertilizerApplicationFormSchemaPartial
              }
            />
          ) : null}
          {request && cultivation && request.type === "harvest-edit" && harvest ? (
            <HarvestForm
              intent={"update_single_harvest"}
              allowBatch={false}
              b_lu={cultivation.b_lu}
              b_id_harvesting={harvest.b_id_harvesting}
              b_lu_cp={harvest.harvestableAnalysis?.b_lu_cp ?? undefined}
              b_lu_croprotation={cultivation?.b_lu_croprotation ?? undefined}
              b_lu_dm={harvest.harvestableAnalysis?.b_lu_dm ?? undefined}
              b_lu_end={cultivation.b_lu_end}
              b_lu_harvest_date={harvest.b_lu_harvest_date}
              b_lu_harvestable={cultivation.b_lu_harvestable}
              b_lu_moist={harvest.harvestableAnalysis?.b_lu_moist ?? undefined}
              b_lu_n_harvestable={harvest.harvestableAnalysis?.b_lu_n_harvestable ?? undefined}
              b_lu_start={cultivation.b_lu_start}
              b_lu_tarra={harvest.harvestableAnalysis?.b_lu_tarra ?? undefined}
              b_lu_uww={harvest.harvestableAnalysis?.b_lu_uww ?? undefined}
              b_lu_yield={harvest.harvestableAnalysis?.b_lu_yield ?? undefined}
              b_lu_yield_bruto={harvest.harvestableAnalysis?.b_lu_yield_bruto ?? undefined}
              b_lu_yield_fresh={harvest.harvestableAnalysis?.b_lu_yield_fresh ?? undefined}
              harvestParameters={harvest.parameters.map((x) => x.id)}
              onDelete={() => setConfirmingDelete(true)}
            />
          ) : null}
        </div>
        {request && (
          <SheetFooter className="flex-row justify-between border-t pt-4">
            {canModify && isEditRequest ? (
              <Button onClick={() => setConfirmingDelete(true)} type="button" variant="destructive">
                Verwijderen
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Annuleren
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
      <AlertDialog onOpenChange={setConfirmingDelete} open={confirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>Dit kan niet ongedaan worden gemaakt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
