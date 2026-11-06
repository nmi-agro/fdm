import type { AppAmountUnit } from "@nmi-agro/fdm-core"
import { z } from "zod"
import { getApplicationAmountUnitLabel } from "./utils"

const fields = {
  intent: z.string().optional(),
  b_id: z.string().optional(),
  p_app_amount_display: z.preprocess(
    (val) => (typeof val === "string" && val !== "" ? Number(val) : val),
    z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? "Hoeveelheid is verplicht"
            : "Hoeveelheid moet een getal zijn",
      })
      .positive({
        error: "Hoeveelheid moet positief zijn",
      }),
  ),
  p_app_method: z.string().trim().min(1, "Toepassingsmethode is verplicht"),
  p_app_date: z.preprocess(
    (val) => (typeof val === "string" ? new Date(val) : val),
    z.date({
      error: (issue) => (issue.input === undefined ? "Datum is verplicht" : "Datum is ongeldig"),
    }),
  ),
  p_id: z.string({
    // TODO: Validate against the options that are available
    error: (issue) =>
      issue.input === undefined ? "Keuze van meststof is verplicht" : "Meststof is ongeldig",
  }),
} as const

export const FormSchema = z.object(fields)

export const FormSchemaPartial = z.object(
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value.or(z.undefined())]),
  ) as {
    [k in keyof typeof fields]: z.ZodUnion<[(typeof fields)[k], z.ZodUndefined]>
  },
)

export const FormSchemaModify = FormSchema.extend({
  p_app_id: z.string({
    error: (issue) =>
      issue.input === undefined ? "Bemesting id is verplicht" : "Bemesting id is ongeldig",
  }),
})

export const FormSchemaPartialModify = FormSchemaPartial.extend({
  p_app_id: z.string({
    error: (issue) =>
      issue.input === undefined ? "Bemesting id is verplicht" : "Bemesting id is ongeldig",
  }),
})

/**
 * Maximum applied amount in kg/ha, the same as `P_APP_AMOUNT_MAX` in fdm-core. Kept here
 * because browser code cannot import fdm-core at runtime.
 */
export const APP_AMOUNT_MAX_KG_PER_HA = 100_000

/** Minimal fertilizer option needed to check the applied amount. */
export interface AppAmountRangeOption {
  /** The fertilizer id (`p_id`). */
  value: string
  /** Display unit of the amount, e.g. `"m3/ha"`. */
  p_app_amount_unit: AppAmountUnit
  /** Maximum amount in the display unit, or `null`/absent when unknown. */
  p_app_amount_display_max?: number | null
}

/**
 * Formats the maximum applied amount for a message. Rounds down so that the shown value is
 * always accepted.
 *
 * @param value - The maximum in the display unit.
 * @returns The value formatted in Dutch, with at most two decimals.
 */
export function formatAppAmountMax(value: number): string {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(
    Math.floor(value * 100) / 100,
  )
}

/**
 * Adds the range check of the applied amount (0 < kg/ha ≤ 100,000) to a fertilizer application
 * schema. The maximum depends on the unit and density of the selected fertilizer, so it is taken
 * from `options`. The lower bound (> 0) is covered by `.positive()` on the field.
 *
 * Apply this last: Zod does not allow `.extend()` on a schema with refinements. When `p_id` or
 * the amount is missing, or the fertilizer is unknown, nothing is checked here; fdm-core checks
 * the stored amount in all cases.
 *
 * @param schema - The fertilizer application schema to refine.
 * @param options - The fertilizer options with their unit and maximum.
 * @returns The schema with the range check.
 */
export function withAppAmountRange<
  T extends z.ZodType<{ p_id?: string | undefined; p_app_amount_display?: number | undefined }>,
>(schema: T, options: AppAmountRangeOption[]) {
  const byId = new Map(options.map((option) => [option.value, option]))
  return schema.superRefine((data, ctx) => {
    if (data.p_app_amount_display === undefined || data.p_id === undefined) return
    const option = byId.get(data.p_id)
    const max = option?.p_app_amount_display_max
    if (!option || max === null || max === undefined) return
    if (data.p_app_amount_display > max) {
      ctx.addIssue({
        code: "custom",
        path: ["p_app_amount_display"],
        message: `Hoeveelheid mag niet groter zijn dan ${formatAppAmountMax(max)} ${getApplicationAmountUnitLabel(option.p_app_amount_unit)}`,
      })
    }
  })
}

export type FieldFertilizerFormValues = z.infer<typeof FormSchema> & {
  p_app_id?: string | undefined
  p_app_ids?: string[] | undefined
}
