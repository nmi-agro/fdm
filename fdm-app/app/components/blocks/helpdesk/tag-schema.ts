import z, { type ZodType } from "zod"

function stringified<T>(validator: ZodType<T, any>) {
  return z
    .string()
    .transform((x) => JSON.parse(x))
    .pipe(validator)
}

export const TagSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1),
  description: z
    .string()
    .trim()
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
})

export const UpdateTagSchema = z.object({
  tag_id: z.string(),
  name: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional(),
  description: z
    .string()
    .trim()
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
})

export const TicketTagsSchema = z.object({
  tags: stringified(z.array(z.string().min(1))),
})
