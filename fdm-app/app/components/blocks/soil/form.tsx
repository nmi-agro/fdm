import type { SoilAnalysis, SoilParameterDescription } from "@nmi-agro/fdm-core"
import type { Control, FieldErrors, Path, Resolver } from "react-hook-form"
import type { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Save, TriangleAlert } from "lucide-react"
import { type ReactNode, useEffect } from "react"
import { Form, useParams } from "react-router"
import { RemixFormProvider, useRemixForm } from "remix-hook-form"
import {
  FormSchema,
  getRangeWarning,
  ReviewedUploadFormSchema,
} from "~/components/blocks/soil/formschema"
import { DatePicker } from "~/components/custom/date-picker-v2"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Spinner } from "~/components/ui/spinner"
import { getContextualDate } from "~/lib/calendar"
import {
  formatSoilUnit,
  groupSoilParameters,
  isInformativeDescription,
  REQUIRED_SAMPLING_PARAMETERS,
} from "./parameter-groups"

type SoilFormValues = z.infer<typeof FormSchema>
type ParameterDescription = SoilParameterDescription[number]

/**
 * Form to add or edit a soil analysis. The parameters are grouped by topic, starting with the
 * sampling (laboratory, date and depth), which is required. When validation fails, a summary
 * above the save button lists every field that needs attention.
 *
 * @param soilAnalysis - The soil analysis to edit; omit to add a new one.
 * @param initialValues - Values to prefill a new soil analysis with, for example values read from
 * a PDF report.
 * @param soilParameterDescription - The parameters to show, with their names, units and options.
 * @param editable - Whether the user may change the values; when false the form is read-only.
 * @param submitLabel - Label of the save button.
 * @param submitData - Extra values to submit with the form, such as an uploaded file.
 * @param encType - Encoding of the submission; use `multipart/form-data` when submitting a file.
 * @param secondaryAction - An extra action next to the save button, such as cancel.
 * @param onValidSubmit - When given, valid values are passed to this function instead of being
 * submitted to the route action, for example to edit a row before a bulk save.
 * @param fromReport - Whether the values were read from a lab report. Values outside their usual
 * range are then allowed and marked with a warning, instead of blocking the save.
 */
export function SoilAnalysisForm(props: {
  soilAnalysis: SoilAnalysis | undefined
  initialValues?: Record<string, unknown>
  soilParameterDescription: SoilParameterDescription
  action: string
  editable?: boolean
  submitLabel?: string
  submitData?: Record<string, unknown>
  encType?: "multipart/form-data" | "application/x-www-form-urlencoded"
  secondaryAction?: ReactNode
  fromReport?: boolean
  onValidSubmit?: (values: Record<string, unknown>) => void
}) {
  const {
    soilAnalysis,
    initialValues,
    soilParameterDescription,
    editable = true,
    submitLabel = "Bodemanalyse opslaan",
    submitData,
    encType,
    secondaryAction,
    fromReport = false,
    onValidSubmit,
  } = props

  // The crop year from the URL, so that a new analysis defaults to a date within that year
  const { calendar } = useParams()
  const defaultValues: Record<string, unknown> = {}
  for (const x of soilParameterDescription) {
    let defaultValue: unknown = soilAnalysis
      ? soilAnalysis[
          x.parameter as keyof Omit<
            SoilAnalysis,
            "b_sampling_geometry" | "b_sampling_geometry_zone"
          >
        ]
      : initialValues?.[x.parameter]

    if ((defaultValue === undefined || defaultValue === null) && x.type === "numeric") {
      defaultValue = ""
    }
    if (defaultValue === undefined && x.type === "text") {
      defaultValue = ""
    }
    // A new analysis gets a date in the selected year; values read from a report keep a missing
    // date empty, so that it is clear it still has to be filled in
    if (defaultValue === undefined && x.type === "date" && !soilAnalysis && !initialValues) {
      defaultValue = getContextualDate(calendar, 2, 1).toISOString()
    }
    if (defaultValue instanceof Date) {
      defaultValue = defaultValue.toISOString()
    }

    defaultValues[x.parameter] = defaultValue
  }
  defaultValues.a_id = undefined

  const form = useRemixForm<SoilFormValues>({
    mode: "onTouched",
    resolver: zodResolver(
      fromReport ? ReviewedUploadFormSchema : FormSchema,
    ) as Resolver<SoilFormValues>,
    defaultValues: defaultValues as Partial<SoilFormValues>,
    submitData,
    submitConfig: encType ? { encType } : undefined,
    submitHandlers: onValidSubmit
      ? { onValid: (values) => onValidSubmit(values as Record<string, unknown>) }
      : undefined,
  })

  const formIsSubmitSuccessful = form.formState.isSubmitSuccessful
  const formReset = form.reset
  // Values read from a report keep the user's checked values, also when saving fails
  useEffect(() => {
    if (formIsSubmitSuccessful && !fromReport) {
      formReset()
    }
  }, [formReset, formIsSubmitSuccessful, fromReport])

  const control = form.control as unknown as Control<Record<string, unknown>>
  const groups = groupSoilParameters(soilParameterDescription.filter((x) => x.parameter !== "a_id"))
  const errorSummary =
    form.formState.submitCount > 0
      ? summarizeErrors(form.formState.errors, soilParameterDescription)
      : []

  return (
    <RemixFormProvider {...form}>
      <Form
        id="soilAnalysisForm"
        onSubmit={form.handleSubmit}
        method="post"
        noValidate
        className="@container max-w-7xl"
      >
        <fieldset disabled={!editable || form.formState.isSubmitting} className="space-y-8">
          {groups.map(({ group, items }) => (
            <fieldset key={group.id} className="space-y-4">
              <div className="space-y-1">
                <legend className="text-sm font-semibold">{group.title}</legend>
                {group.id === "sampling" && editable && (
                  <p className="text-muted-foreground text-sm">
                    Velden met <span aria-hidden>*</span>
                    <span className="sr-only">een sterretje</span> zijn verplicht.
                  </p>
                )}
              </div>
              <div className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4">
                {items.map((x) => (
                  <SoilParameterField
                    key={x.parameter}
                    control={control}
                    parameter={x}
                    warnOutOfRange={fromReport}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          {errorSummary.length > 0 && (
            <Alert variant="destructive" role="alert">
              <AlertCircle aria-hidden />
              <AlertTitle>
                {errorSummary.length === 1
                  ? "Controleer 1 veld"
                  : `Controleer ${errorSummary.length} velden`}
              </AlertTitle>
              <AlertDescription>
                <ul className="list-disc space-y-0.5 pl-4">
                  {errorSummary.map((error) => (
                    <li key={error.parameter}>
                      {error.label}: {error.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {editable && (
            // Stays in view at the bottom of the screen while the form is on screen, so saving is
            // always one click away in a long form
            <div className="bg-background sticky bottom-0 z-10 flex flex-col gap-3 border-t py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm" aria-live="polite">
                {errorSummary.length > 0 ? (
                  <span className="text-destructive font-medium">
                    {errorSummary.length === 1
                      ? "1 veld moet nog worden aangepast"
                      : `${errorSummary.length} velden moeten nog worden aangepast`}
                  </span>
                ) : form.formState.isDirty ? (
                  onValidSubmit ? (
                    <span key="dirty-apply">Je wijzigingen zijn nog niet toegepast.</span>
                  ) : (
                    <span key="dirty-save">Je wijzigingen zijn nog niet opgeslagen.</span>
                  )
                ) : soilAnalysis || onValidSubmit ? (
                  <span key="clean">Nog geen wijzigingen.</span>
                ) : (
                  <span key="new">De bodemanalyse wordt vastgelegd als je opslaat.</span>
                )}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center max-sm:[&>*]:w-full pointer-coarse:[&>*]:h-11">
                {secondaryAction}
                <Button type="submit" size="lg">
                  {form.formState.isSubmitting ? (
                    <>
                      <Spinner />
                      <span>Opslaan…</span>
                    </>
                  ) : (
                    <>
                      <Save aria-hidden />
                      <span>{submitLabel}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </fieldset>
      </Form>
    </RemixFormProvider>
  )
}

/** One input of the soil analysis form, chosen by the type of the parameter. */
function SoilParameterField({
  control,
  parameter: x,
  warnOutOfRange,
}: {
  control: Control<Record<string, unknown>>
  parameter: ParameterDescription
  /** Whether to warn about a value outside its usual range. */
  warnOutOfRange: boolean
}) {
  const isRequired = REQUIRED_SAMPLING_PARAMETERS.includes(x.parameter)
  const unit = formatSoilUnit(x.unit)
  const description = isInformativeDescription(x.name, x.description) ? x.description : undefined
  const label = (
    <>
      {x.name}
      {isRequired && (
        <span aria-hidden className="text-muted-foreground">
          {" "}
          *
        </span>
      )}
      {unit && <span className="sr-only"> ({unit})</span>}
    </>
  )
  const name = x.parameter as Path<Record<string, unknown>>

  if (x.type === "numeric") {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  {...field}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={
                    typeof field.value === "number" || typeof field.value === "string"
                      ? field.value
                      : ""
                  }
                  aria-required={isRequired}
                  className="[appearance:textfield] tabular-nums pointer-coarse:h-11 pointer-coarse:text-base [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={unit ? { paddingRight: `${unit.length + 2}ch` } : undefined}
                />
                {unit && (
                  <span
                    aria-hidden
                    className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm"
                  >
                    {unit}
                  </span>
                )}
              </div>
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
            {warnOutOfRange && <RangeWarning parameter={x.parameter} value={field.value} />}
          </FormItem>
        )}
      />
    )
  }

  if (x.type === "enum") {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={typeof field.value === "string" ? field.value : undefined}
              disabled={field.disabled}
            >
              <FormControl>
                <SelectTrigger
                  aria-required={isRequired}
                  onBlur={field.onBlur}
                  className="pointer-coarse:h-11 pointer-coarse:text-base"
                >
                  <SelectValue placeholder="Kies…" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {x.options?.map((option: { value: string; label: string }) =>
                  // NMI BodemSchat estimates are made by the system, never entered by a user
                  option.value === "nl-other-nmi" ? null : (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ),
                ) ?? null}
              </SelectContent>
            </Select>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  if (x.type === "date") {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <DatePicker
            label={label}
            description={description}
            field={field}
            fieldState={fieldState}
            required={isRequired}
            className="pointer-coarse:[&_input]:h-11 pointer-coarse:[&_input]:text-base"
          />
        )}
      />
    )
  }

  if (x.type === "text") {
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                value={typeof field.value === "string" ? field.value : ""}
                aria-required={isRequired}
                className="pointer-coarse:h-11 pointer-coarse:text-base"
              />
            </FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return null
}

/** A non-blocking warning for a value outside the usual range of its parameter. */
function RangeWarning({ parameter, value }: { parameter: string; value: unknown }) {
  const warning = getRangeWarning(parameter, value)
  if (!warning) return null
  return (
    <p className="flex items-start gap-1.5 text-sm text-amber-800">
      <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {warning}
    </p>
  )
}

/** Lists the validation errors of the form with the name of the parameter they belong to. */
function summarizeErrors(
  errors: FieldErrors,
  soilParameterDescription: SoilParameterDescription,
): { parameter: string; label: string; message: string }[] {
  return Object.entries(errors).flatMap(([parameter, error]) => {
    const message = typeof error?.message === "string" ? error.message : undefined
    if (!message) return []
    const label = soilParameterDescription.find((x) => x.parameter === parameter)?.name ?? parameter
    return [{ parameter, label, message }]
  })
}
