import type { HarvestParameters } from "@nmi-agro/fdm-core"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import { Form, useNavigation } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import type { TimelineEventFormData } from "~/lib/timeline-data.server"
import { CultivationAddForm } from "~/components/blocks/cultivation/form-add"
import { CultivationDetailsFormSchema } from "~/components/blocks/cultivation/schema"
import { FertilizerApplicationForm } from "~/components/blocks/fertilizer-applications/form"
import { HarvestForm } from "~/components/blocks/harvest/form"
import { DatePicker } from "~/components/custom/date-picker"
import { Button } from "~/components/ui/button"
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
  eventFormData,
}: {
  request: AddEventSheetRequest | undefined
  onOpenChange: (open: boolean) => void
  b_id_farm: string
  calendar: string
  fields: TimelineField[]
  eventFormData: TimelineEventFormData
}) {
  const open = !!request
  const field = request ? fields.find((f) => f.b_id === request.context.b_id) : undefined
  const basePath = field ? `/farm/${b_id_farm}/${calendar}/field/${field.b_id}` : undefined
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
          {request && field && basePath && request.type === "fertilizer" ? (
            <FertilizerApplicationForm
              action={`${basePath}/fertilizer`}
              b_id_farm={b_id_farm}
              b_id_or_b_lu_catalogue={field.b_id}
              exampleFertilizerApplication={{ p_app_date: request.context.date }}
              options={eventFormData.fertilizerOptions}
              navigation={navigation as never}
            />
          ) : null}

          {request && field && basePath && request.type === "harvest" ? (
            cultivation ? (
              <HarvestForm
                action={`${basePath}/cultivation/${cultivation.b_lu}/harvest/new`}
                allowBatch={false}
                b_date_harvest_default={
                  eventFormData.harvestDefaultsByCatalogue[cultivation.b_lu_catalogue]
                    ?.b_date_harvest_default ?? null
                }
                b_lu_cp={undefined}
                b_lu_croprotation={cultivation.b_lu_croprotation ?? undefined}
                b_lu_dm={undefined}
                b_lu_end={cultivation.b_lu_end}
                b_lu_harvest_date={undefined}
                b_lu_harvestable={cultivation.b_lu_harvestable}
                b_lu_moist={undefined}
                b_lu_n_harvestable={undefined}
                b_lu_start={cultivation.b_lu_start}
                b_lu_tarra={undefined}
                b_lu_uww={undefined}
                b_lu_yield={undefined}
                b_lu_yield_bruto={undefined}
                b_lu_yield_fresh={undefined}
                harvestParameters={
                  (eventFormData.harvestParametersByCat[cultivation.b_lu_harvestcat ?? ""] ??
                    []) as HarvestParameters
                }
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Er is geen actief gewas op dit perceel voor deze datum.
              </p>
            )
          ) : null}

          {request && field && basePath && request.type === "cultivation-start" ? (
            <CultivationAddForm
              action={`${basePath}/cultivation`}
              defaultValues={{
                b_lu_catalogue: "",
                b_lu_start: request.context.date,
              }}
              options={eventFormData.cultivationCatalogueOptions}
            />
          ) : null}

          {request && field && basePath && request.type === "cultivation-end" ? (
            cultivation ? (
              <CultivationEndForm
                action={`${basePath}/cultivation/${cultivation.b_lu}`}
                b_lu_end={request.context.date}
                b_lu_start={cultivation.b_lu_start}
              />
            ) : (
              <p className="text-muted-foreground text-sm">Geen gewas gevonden om te beëindigen.</p>
            )
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Minimal "cultivation dates" form reused for "Gewas beëindigen": same visual pattern as
 *  starting a cultivation (`CultivationAddForm`), but only exposes the end date — the crop and
 *  start date are already fixed for an existing cultivation — targeting the update route (POST)
 *  instead of the create route. */
function CultivationEndForm({
  action,
  b_lu_start,
  b_lu_end,
}: {
  action: string
  b_lu_start: Date | null
  b_lu_end: Date
}) {
  const form = useRemixForm<z.infer<typeof CultivationDetailsFormSchema>>({
    mode: "onTouched",
    resolver: zodResolver(CultivationDetailsFormSchema) as never,
    defaultValues: {
      b_lu_start: b_lu_start ?? new Date(),
      b_lu_end,
    },
  })

  useEffect(() => {
    form.reset({ b_lu_start: b_lu_start ?? new Date(), b_lu_end })
    // Only re-seed when the target cultivation/date changes, not on every form state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b_lu_start, b_lu_end])

  return (
    <RemixFormProvider {...form}>
      <Form action={action} id="formCultivationEnd" method="post" onSubmit={form.handleSubmit}>
        <div className="grid gap-4">
          <DatePicker
            description="Zaaidatum (kan hier niet worden gewijzigd)"
            disabled
            form={form as any}
            label="Zaaidatum"
            name="b_lu_start"
          />
          <DatePicker
            description="Datum waarop het gewas wordt beëindigd"
            disabled={form.formState.isSubmitting}
            form={form as any}
            label="Einddatum"
            name="b_lu_end"
          />
          <Button className="w-full" type="submit">
            {form.formState.isSubmitting ? "Opslaan..." : "Beëindigen"}
          </Button>
        </div>
      </Form>
    </RemixFormProvider>
  )
}
