import { z } from "zod"

/**
 * The usual range (minimum and maximum) of each optional numeric soil parameter on the soil
 * analysis form. Manual entry must stay within these ranges; values read from a PDF report outside
 * them are shown with a warning.
 */
export const SOIL_PARAMETER_RANGES = {
  a_al_ox: [0.1, 1000],
  a_c_of: [0.1, 600],
  a_ca_co: [0.1, 500],
  a_ca_co_po: [1, 100],
  a_caco3_if: [0.1, 50],
  a_cec_co: [1, 1000],
  a_clay_mi: [0.1, 75],
  a_cn_fr: [5, 40],
  a_com_fr: [0.3, 0.8],
  a_cu_cc: [0.1, 1000],
  a_density_sa: [0.5, 3],
  a_fe_ox: [0.1, 1000],
  a_k_cc: [1, 600],
  a_k_co: [0.1, 150],
  a_k_co_po: [0.1, 50],
  a_mg_cc: [1, 1100],
  a_mg_co: [0.1, 150],
  a_mg_co_po: [0.1, 50],
  a_n_pmn: [1, 500],
  a_n_rt: [1, 30000],
  a_nmin_cc: [0, 500],
  a_nh4_cc: [0, 500],
  a_no3_cc: [0, 500],
  a_p_al: [1, 250],
  a_p_cc: [0.1, 100],
  a_p_ox: [0.1, 100],
  a_p_rt: [0.01, 10],
  a_p_sg: [0.1, 100],
  a_p_wa: [1, 250],
  a_ph_cc: [3, 10],
  a_s_rt: [1, 10000],
  a_sand_mi: [0.1, 100],
  a_silt_mi: [0.1, 100],
  a_som_loi: [0.5, 75],
  a_zn_cc: [5, 50000],
} as const satisfies Record<string, readonly [number, number]>

/** Formats a number for a Dutch message, for example `1.000` or `0,1`. */
export function formatRangeNumber(value: number): string {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 3 })
}

function optionalNumber(range: readonly [number, number], enforceRange: boolean) {
  let schema = z.coerce.number({ error: "Waarde moet een getal zijn" })
  if (enforceRange) {
    const [min, max] = range
    schema = schema
      .gte(min, `Waarde moet groter of gelijk aan ${formatRangeNumber(min)} zijn`)
      .lte(max, `Waarde moet kleiner of gelijk aan ${formatRangeNumber(max)} zijn`)
  }
  return z.preprocess((val) => (val === "" || val === null ? undefined : val), schema.optional())
}

/**
 * Creates the schema of the soil analysis form.
 *
 * @param enforceRanges - Whether the optional soil parameters must stay within
 * {@link SOIL_PARAMETER_RANGES}. The sampling details (laboratory, date and depth) are always
 * required and checked.
 */
export function createSoilAnalysisFormSchema({ enforceRanges }: { enforceRanges: boolean }) {
  const parameters = Object.fromEntries(
    Object.entries(SOIL_PARAMETER_RANGES).map(([parameter, range]) => [
      parameter,
      optionalNumber(range, enforceRanges),
    ]),
  ) as { [K in keyof typeof SOIL_PARAMETER_RANGES]: ReturnType<typeof optionalNumber> }

  return z
    .object({
      a_source: z
        .string({
          error: (issue) =>
            issue.input === undefined ? "Kies een laboratorium" : "Laboratorium is ongeldig",
        })
        .refine((value) => value.toLowerCase() !== "nl-other-nmi", {
          error: "Bron mag niet 'NMI BodemSchat' zijn.",
        }),
      b_sampling_date: z.preprocess(
        (val) => (typeof val === "string" ? new Date(val) : val),
        z.date({
          error: (issue) => (issue.input === undefined ? "Vul een datum in" : "Datum is ongeldig"),
        }),
      ),
      a_depth_upper: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.coerce
          .number({
            error: (issue) =>
              issue.input === undefined ? undefined : "Waarde moet een getal zijn",
          })
          .gte(0, "Waarde moet groter of gelijk aan 0 zijn")
          .lte(200, "Waarde moet kleiner of gelijk aan 200 zijn")
          .optional(),
      ),
      // An empty field means "not filled in", not 0, so it gets the "fill in" message
      a_depth_lower: z.preprocess(
        (val) => (val === "" || val === null ? undefined : val),
        z.coerce
          .number({
            error: (issue) =>
              issue.input === undefined
                ? "Vul in tot hoe diep is bemonsterd"
                : "Waarde moet een getal zijn",
          })
          .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
          .lte(200, "Waarde moet kleiner of gelijk aan 200 zijn"),
      ),
      ...parameters,
      b_gwl_class: z.string().optional(),
      b_soiltype_agr: z.string().optional(),
    })
    .refine(
      (data) => {
        if (typeof data.a_depth_upper === "number" && typeof data.a_depth_lower === "number") {
          return data.a_depth_lower > data.a_depth_upper
        }
        return true
      },
      {
        path: ["a_depth_upper"],
        error: "Bovenkant van bemonsterde laag moet minder diep zijn dan onderkant",
      },
    )
}

/** Schema of the soil analysis form for manual entry: every value must be within its usual range. */
export const FormSchema = createSoilAnalysisFormSchema({ enforceRanges: true })

/**
 * Schema for saving values read from a PDF report and checked by the user. Values outside their
 * usual range are allowed, because the report is the source; the form warns about them instead.
 */
export const ReviewedUploadFormSchema = createSoilAnalysisFormSchema({ enforceRanges: false })

/**
 * Returns a warning when a value is outside the usual range of its parameter, or `undefined`.
 */
export function getRangeWarning(parameter: string, value: unknown): string | undefined {
  const range = (SOIL_PARAMETER_RANGES as Record<string, readonly [number, number]>)[parameter]
  if (!range || value === "" || value === null || value === undefined) return undefined
  const number = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(number)) return undefined
  const [min, max] = range
  if (number >= min && number <= max) return undefined
  return `Buiten het gebruikelijke bereik (${formatRangeNumber(min)} tot ${formatRangeNumber(max)}). Controleer de waarde in het rapport.`
}
