import type { MouseEvent, ReactNode } from "react"
import type { Navigation } from "react-router"
/* eslint-disable typescript/unbound-method -- react-hook-form registration and control references are unbound by design in standard React Hook Form usage. */
import { zodResolver } from "@hookform/resolvers/zod"
import { formatDate } from "date-fns"
import { nl } from "date-fns/locale"
import { Plus } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { Controller, useWatch } from "react-hook-form"
import { Form, useNavigate, useSearchParams } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import { cn } from "@/app/lib/utils"
import { useFieldFertilizerFormStore } from "@/app/store/field-fertilizer-form"
import { getApplicationAmountUnitLabel } from "~/components/blocks/fertilizer-applications/utils"
import { Combobox } from "~/components/custom/combobox"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Button } from "~/components/ui/button"
import { Field, FieldError, FieldLabel } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { getContextualDate } from "~/lib/calendar"
import { useCalendarStore } from "~/store/calendar"
import type { FertilizerOption } from "./types.d"
import { DRAFT_SAVED_STATE } from "./bulk/use-unsaved-changes-guard"
import {
  type FieldFertilizerFormValues,
  FormSchema,
  FormSchemaModify,
  type FormSchemaPartial,
} from "./formschema"

/**
 * Renders a fertilizer application creation or modification form.
 *
 * The form contains fields for the fertilizer applied, the application method, the amount, and the application date.
 *
 * It accepts two partial FieldFertilizerFormValues objects to pre-fill the form and set the placeholders.
 * - The fields are pre-filled according to the fertilizerApplication prop value. If it is missing, all form fields are left empty. fertilizerApplication cannot be used to drive the form state.
 * - The placeholders will be set according to the exampleFertilizerApplication prop value. If it is missing, the default placeholders are used for all form fields.
 *
 * Optional props for embedding the form in a larger page:
 * - `submitLabel` replaces the text of the submit button.
 * - `onValuesChange` is called with the current form values whenever a value changes, for example to preview the effect of the application.
 * - `footerSlot` is rendered directly above the submit button, for example for warnings.
 * - `submitDisabledReason` disables the submit button and shows the reason next to it.
 * - `onCancel` adds an Annuleren button next to the submit button, for example to stop editing.
 * - `onDirtyChange` is called when the user starts or stops having unsaved input, for example to
 *   warn before leaving the page.
 */
export function FertilizerApplicationForm<T extends typeof FormSchemaPartial>({
  intent,
  b_id,
  options,
  action,
  navigation,
  b_id_farm,
  b_id_or_b_lu_catalogue,
  fertilizerApplication,
  exampleFertilizerApplication,
  schema,
  fieldsClassName,
  submitLabel,
  onValuesChange,
  footerSlot,
  submitDisabledReason,
  id,
  submitAreaClassName,
  onCancel,
  onDirtyChange,
}: {
  intent?: string
  b_id?: string
  options: FertilizerOption[]
  action: string
  navigation: Navigation
  b_id_farm: string
  b_id_or_b_lu_catalogue: string
  fertilizerApplication?: Partial<FieldFertilizerFormValues> | null | undefined
  exampleFertilizerApplication?: Partial<FieldFertilizerFormValues> | null | undefined
  schema?: T
  fieldsClassName?: string
  submitLabel?: string
  onValuesChange?: (values: Partial<FieldFertilizerFormValues>) => void
  footerSlot?: ReactNode
  submitDisabledReason?: string
  /** Id of the form element, so a button elsewhere on the page can submit it. */
  id?: string
  submitAreaClassName?: string
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const generatedFormId = useId()
  const formId = id ?? generatedFormId
  const { calendar } = useCalendarStore()
  const form = useRemixForm<FieldFertilizerFormValues>({
    mode: "onTouched",
    resolver: zodResolver(
      schema ?? (fertilizerApplication ? FormSchemaModify : FormSchema),
    ) as never,
    defaultValues: {
      intent: intent,
      b_id: b_id,
      p_app_id: fertilizerApplication?.p_app_ids
        ? fertilizerApplication.p_app_ids.join(",")
        : fertilizerApplication?.p_app_id,
      p_id: fertilizerApplication?.p_id,
      p_app_method: fertilizerApplication?.p_app_method,
      p_app_amount_display: undefined, // Handled through an effect due to blank behavior
      p_app_date: fertilizerApplication?.p_app_date
        ? fertilizerApplication.p_app_date
        : exampleFertilizerApplication
          ? undefined
          : getContextualDate(calendar, 3, 1),
    },
    submitConfig: {
      method: fertilizerApplication ? "PUT" : "POST",
    },
  })

  // Report whether the user has unsaved input, for example to warn before leaving the page
  const isDirty = form.formState.isDirty
  const onDirtyChangeRef = useRef(onDirtyChange)
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange
  })
  useEffect(() => {
    onDirtyChangeRef.current?.(isDirty)
  }, [isDirty])

  // Report value changes to the parent, for example to preview the effect of the application
  const onValuesChangeRef = useRef(onValuesChange)
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange
  }, [onValuesChange])
  const hasValuesListener = Boolean(onValuesChange)
  const { watch, getValues } = form
  useEffect(() => {
    if (!hasValuesListener) return
    onValuesChangeRef.current?.(getValues())
    const subscription = watch((values) =>
      onValuesChangeRef.current?.(values as Partial<FieldFertilizerFormValues>),
    )
    return () => subscription.unsubscribe()
  }, [hasValuesListener, watch, getValues])

  const p_id = useWatch({ control: form.control, name: "p_id" })
  const selectedFertilizer = options.find((option) => option.value === p_id)
  // Only a form submission counts; leaving the page without saving is a navigation without form
  // data and must not look like saving
  const isSubmitting = navigation.state !== "idle" && Boolean(navigation.formData)
  // With a custom (partial) schema, empty fields keep their value, so they are not required
  const requiredMarker = schema ? null : (
    <span className="text-red-500" aria-hidden="true">
      *
    </span>
  )

  // If the user switched the fertilizer, clear the amount and the application method. When the
  // fertilizer has a single application method, choose it right away.
  const formSetValue = form.setValue
  const singleMethod =
    selectedFertilizer?.applicationMethodOptions.length === 1
      ? selectedFertilizer.applicationMethodOptions[0].value
      : undefined
  useEffect(() => {
    if (p_id && (!fertilizerApplication || fertilizerApplication.p_id !== p_id)) {
      formSetValue("p_app_method", singleMethod ?? "")
      formSetValue("p_app_amount_display", undefined as unknown as number)
    }
  }, [formSetValue, p_id, fertilizerApplication, singleMethod])

  const formGetFieldState = form.getFieldState
  const form_p_app_date = useWatch({ control: form.control, name: "p_app_date" })
  useEffect(() => {
    const { isDirty } = formGetFieldState("p_app_date")
    if (
      !fertilizerApplication?.p_app_date &&
      !exampleFertilizerApplication &&
      !form_p_app_date &&
      !isDirty
    ) {
      formSetValue("p_app_date", getContextualDate(calendar, 3, 1))
    }
  }, [
    formSetValue,
    formGetFieldState,
    form_p_app_date,
    calendar,
    exampleFertilizerApplication,
    fertilizerApplication?.p_app_date,
  ])

  // Selected individually: these action methods are referentially stable forever, unlike the
  // store object itself (which changes identity on every state update, including from other forms).
  const loadFertilizerForm = useFieldFertilizerFormStore((s) => s.load)
  const saveFertilizerForm = useFieldFertilizerFormStore((s) => s.save)
  const deleteFertilizerForm = useFieldFertilizerFormStore((s) => s.delete)

  // If the user had a saved fertilizer form and was creating a new fertilizer, fill the form back in
  useEffect(() => {
    if (b_id_farm && b_id_or_b_lu_catalogue) {
      const savedFormValues = loadFertilizerForm(b_id_farm, b_id_or_b_lu_catalogue, calendar)
      if (savedFormValues) {
        for (const [k, v] of Object.entries(savedFormValues)) {
          if (typeof v === "undefined" || v === null) continue
          const hydrated = k === "p_app_date" && v ? new Date(v as any) : (v as any)
          form.setValue(k as any, hydrated)
        }
      }
    }
  }, [b_id_farm, b_id_or_b_lu_catalogue, form, loadFertilizerForm, calendar])

  useEffect(() => {
    const p_app_amount_display = fertilizerApplication?.p_app_amount_display
    if (p_app_amount_display !== null && typeof p_app_amount_display !== "undefined") {
      formSetValue("p_app_amount_display", Math.round(100 * p_app_amount_display) / 100)
    }
  }, [formSetValue, fertilizerApplication?.p_app_amount_display])

  // Change fertilizer selection if the user has added a new fertilizer
  const new_p_id = searchParams.get("p_id")
  useEffect(() => {
    if (new_p_id) {
      formSetValue("p_id", new_p_id)
    }
  }, [formSetValue, new_p_id])

  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      deleteFertilizerForm(b_id_farm, b_id_or_b_lu_catalogue, calendar)
    }
  }, [
    form.formState.isSubmitSuccessful,
    b_id_farm,
    b_id_or_b_lu_catalogue,
    deleteFertilizerForm,
    calendar,
  ])

  function handleManageFertilizers(_e: MouseEvent<HTMLButtonElement>) {
    if (b_id_farm && b_id_or_b_lu_catalogue) {
      saveFertilizerForm(b_id_farm, b_id_or_b_lu_catalogue, form.getValues(), calendar)
    }
    // The input is kept as a draft, so a warning about unsaved input is not needed
    void navigate(
      `/farm/${b_id_farm}/fertilizers/new?returnUrl=${encodeURIComponent(`${location.pathname}${location.search}`)}`,
      { state: DRAFT_SAVED_STATE },
    )
  }

  const currentApplicationUnit =
    options.find((opt) => opt.value === p_id)?.p_app_amount_unit ?? "kg/ha"
  const currentApplicationUnitLabel = getApplicationAmountUnitLabel(currentApplicationUnit)

  return (
    <RemixFormProvider {...form}>
      <Form id={formId} action={action} onSubmit={form.handleSubmit} method="post">
        <fieldset disabled={isSubmitting}>
          <div
            className={cn(
              "grid grid-cols-1 items-start gap-x-8 gap-y-4 md:grid-cols-2",
              fieldsClassName,
            )}
          >
            <div className="flex min-w-0 flex-row align-top">
              <div className="min-w-0 flex-1">
                <Combobox
                  options={options}
                  form={form}
                  name="p_id"
                  label={
                    <span>
                      Meststof
                      {requiredMarker}
                    </span>
                  }
                  defaultValue={fertilizerApplication?.p_id}
                />
              </div>
              <div className="shrink-0 grow-0 space-y-2">
                <Label className="invisible">&nbsp;</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      className="ml-2"
                      onClick={handleManageFertilizers}
                      aria-label="Voeg een nieuwe meststof toe"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voeg een nieuwe meststof toe</TooltipContent>
                </Tooltip>
              </div>
            </div>
            {typeof intent === "string" && <input type="hidden" name="intent" value={intent} />}
            {typeof b_id === "string" && <input type="hidden" name="b_id" value={b_id} />}
            <Controller
              name="p_app_method"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                  <FieldLabel>
                    <span>
                      Toedieningsmethode
                      {requiredMarker}
                    </span>
                  </FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={!selectedFertilizer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer een methode" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedFertilizer?.applicationMethodOptions?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="p_app_amount_display"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1">
                  <FieldLabel>
                    <span>
                      Hoeveelheid ({currentApplicationUnitLabel}){requiredMarker}
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    placeholder={
                      Number.isFinite(exampleFertilizerApplication?.p_app_amount_display) &&
                      fertilizerApplication?.p_id === p_id
                        ? `Verschillend, bv. ${exampleFertilizerApplication?.p_app_amount_display} ${currentApplicationUnitLabel}`
                        : `Bv. ${({ "kg/ha": "3700", "ton/ha": "3,7", "l/ha": "3700", "m3/ha": "3,7" } as const)[currentApplicationUnit]} ${currentApplicationUnitLabel}`
                    }
                    aria-required="true"
                    aria-invalid={fieldState.invalid}
                    type="number"
                    value={
                      field.value === undefined ||
                      field.value === null ||
                      Number.isNaN(Number.parseFloat(String(field.value)))
                        ? ""
                        : field.value
                    }
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === "") {
                        field.onChange(undefined)
                      } else {
                        field.onChange(Number.parseFloat(val))
                      }
                    }}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="p_app_date"
              control={form.control}
              render={({ field, fieldState }) => (
                <DatePicker
                  label={
                    <span>
                      Datum
                      {requiredMarker}
                    </span>
                  }
                  placeholder={
                    exampleFertilizerApplication?.p_app_date
                      ? `Verschillend, bv. ${formatDate(exampleFertilizerApplication.p_app_date, "PP", { locale: nl })}`
                      : undefined
                  }
                  defaultValue={fertilizerApplication?.p_app_date}
                  field={{
                    ...field,
                    value: field.value,
                  }}
                  fieldState={fieldState}
                />
              )}
            />
            {footerSlot ? (
              <div className="col-span-full">{footerSlot}</div>
            ) : (
              <div className="invisible" />
            )}
            <div
              className={cn(
                "col-span-full ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 md:col-span-1",
                submitAreaClassName,
              )}
            >
              {submitDisabledReason && (
                <p className="text-muted-foreground text-sm">{submitDisabledReason}</p>
              )}
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                  Annuleren
                </Button>
              )}
              <Button type="submit" disabled={Boolean(submitDisabledReason)}>
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Spinner />
                    <span>Opslaan...</span>
                  </div>
                ) : (
                  (submitLabel ?? (fertilizerApplication ? "Opslaan" : "Voeg toe"))
                )}
              </Button>
            </div>
          </div>
        </fieldset>
      </Form>
    </RemixFormProvider>
  )
}
