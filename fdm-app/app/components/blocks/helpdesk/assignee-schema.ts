import z, { type ZodType } from "zod"

function stringified<T>(validator: ZodType<T, any>) {
  return z
    .string()
    .transform((x) => JSON.parse(x))
    .pipe(validator)
}

export const AssigneeSchema = z.object({
  primary: stringified(z.array(z.string().min(1))),
  assignees: stringified(z.array(z.string().min(1))),
})
