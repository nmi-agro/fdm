import z from "zod"

export const AbsenceReasonSchema = z.enum(["holiday", "day_off", "sick", "other"])

export const ABSENCE_REASON_LABELS: Record<z.infer<typeof AbsenceReasonSchema>, string> = {
  holiday: "Vakantie",
  day_off: "Vrije dag",
  sick: "Ziek",
  other: "Overig",
}

export const AbsenceReasonOptions = AbsenceReasonSchema.options.map((value) => ({
  value,
  label: ABSENCE_REASON_LABELS[value],
}))

// Dates are submitted as "yyyy-MM-dd" strings from the <input type="date"> fields (or already as
// Date instances internally). A plain "yyyy-MM-dd" string is parsed as *local* midnight rather
// than UTC midnight — the built-in `new Date("yyyy-MM-dd")` / `z.coerce.date()` parses date-only
// strings as UTC, which shifts the date by a day in any timezone other than UTC (e.g. GMT+2).
const AbsenceDateSchema = z.union([z.date(), z.string().min(1)]).transform((value, ctx) => {
  if (value instanceof Date) return value

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match) {
    const [, year, month, day] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: "custom", message: "Ongeldige datum" })
    return z.NEVER
  }
  return parsed
})

export const ScheduleAbsenceSchema = z
  .object({
    agent_id: z.string().min(1),
    start_date: AbsenceDateSchema,
    end_date: AbsenceDateSchema,
    reason: AbsenceReasonSchema,
    note: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "De einddatum moet na de startdatum liggen.",
    path: ["end_date"],
  })

export const UpdateAbsenceSchema = z
  .object({
    absence_id: z.string().min(1),
    start_date: AbsenceDateSchema,
    end_date: AbsenceDateSchema,
    reason: AbsenceReasonSchema,
    note: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  })
  .refine((value) => value.end_date >= value.start_date, {
    message: "De einddatum moet na de startdatum liggen.",
    path: ["end_date"],
  })

export const DeleteAbsenceSchema = z.object({
  absence_id: z.string().min(1),
})
