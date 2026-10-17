import z from "zod"
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

const NewFieldInitSchema = z.object({
  b_name: z.string(),
  b_id_source: z.string().nullable(),
  b_geometry: z.object(),
  b_lu_catalogue: z.string().nullable(),
  b_start: NonNullableDateSchema,
  b_end: NullableDateSchema,
  b_acquiring_method: AcquiringMethodSchema,
  b_bufferstrip: z.boolean(),
})

const UpdateFieldInitSchema = NewFieldInitSchema.partial().extend({
  b_id: z.string(),
  b_lu: z.string().optional(),
})

export const ImportReviewChoicesSchema = z.object({
  fieldsToAdd: z.array(NewFieldInitSchema),
  fieldsToRemove: z.string().array(),
  fieldsToUpdate: UpdateFieldInitSchema.array(),
})
