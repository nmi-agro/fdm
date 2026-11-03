import z from "zod"
import { adjustEndDateAtYearStart } from "~/lib/calendar"
import { acquiringMethodOptions } from "~/lib/constants"

const NonNullableDateSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    if (value.toLowerCase() === "null") return null
  }
  return value
}, z.coerce.date())

const NullableDateSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    if (value.toLowerCase() === "null") return null
  }
  return value
}, z.coerce.date().nullable())

const AcquiringMethodSchema = z.enum(acquiringMethodOptions.map((item) => item.value))

/**
 * Checks that a field's end date, when it has one, lies after its start date. An end date on
 * 1 January counts as the end of the previous day, as in fdm-core.
 */
export function isValidFieldPeriod(b_start: unknown, b_end: unknown): boolean {
  if (b_end === null || b_end === undefined) return true
  const start = new Date(b_start as string | Date)
  const end = new Date(b_end as string | Date)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false
  return start.getTime() < adjustEndDateAtYearStart(end).getTime()
}

/** Prefixes a validation message with the name of the field it applies to, when known. */
function forField(b_name: string | undefined, message: string) {
  return b_name ? `Perceel "${b_name}": ${message}` : message
}

const FieldNameSchema = z.string().trim().min(1, "Vul een naam in voor elk perceel.")

const FieldInitBaseSchema = z.object({
  b_name: FieldNameSchema,
  b_id_source: z.string().nullable(),
  b_geometry: z.looseObject({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.any()),
  }),
  b_lu_catalogue: z.string().nullable(),
  b_start: NonNullableDateSchema,
  b_end: NullableDateSchema,
  b_acquiring_method: AcquiringMethodSchema,
  b_bufferstrip: z.boolean(),
})

const fieldPeriodRefinement = {
  error: (issue: { input: unknown }) =>
    forField(
      (issue.input as { b_name?: string } | undefined)?.b_name,
      "de einddatum moet na de ingangsdatum liggen.",
    ),
  path: ["b_end"],
}

const NewFieldInitSchema = FieldInitBaseSchema.refine(
  (field) => isValidFieldPeriod(field.b_start, field.b_end),
  fieldPeriodRefinement,
)

// Only the changed values are submitted. When one of the dates is missing, fdm-core checks the
// period against the stored date.
const UpdateFieldInitSchema = FieldInitBaseSchema.partial()
  .extend({
    b_id: z.string(),
    b_lu: z.string().optional(),
  })
  .refine(
    (field) => field.b_start === undefined || isValidFieldPeriod(field.b_start, field.b_end),
    fieldPeriodRefinement,
  )

export const ImportReviewChoicesSchema = z.object({
  fieldsToAdd: z.array(NewFieldInitSchema),
  fieldsToRemove: z.string().array(),
  fieldsToUpdate: UpdateFieldInitSchema.array(),
})

/**
 * Turns a failed validation of the submitted review into a message for the user. Returns
 * `undefined` for any other error.
 */
export function getImportValidationMessage(error: unknown): string | undefined {
  if (!(error instanceof z.ZodError)) return undefined
  const messages = [...new Set(error.issues.map((issue) => issue.message))]
  return `Niet alle percelen kunnen worden opgeslagen. ${messages.join(" ")}`
}
