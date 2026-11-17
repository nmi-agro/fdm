import z, { type ZodType } from "zod"

function stringified<T>(validator: ZodType<T, any>) {
  return z
    .string()
    .transform((x, ctx) => {
      try {
        return JSON.parse(x)
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Invalid JSON",
        })
        return z.NEVER
      }
    })
    .pipe(validator)
}

export const AssigneeSchema = z.object({
  primary: stringified(z.array(z.string().min(1))),
  assignees: stringified(z.array(z.string().min(1))),
})
