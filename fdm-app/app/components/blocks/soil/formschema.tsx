import { z } from "zod"

export const FormSchema = z
    .object({
        a_source: z
            .string({
                error: (issue) =>
                    issue.input === undefined
                        ? "Kies een laboratorium"
                        : "Laboratorium is ongeldig",
            })
            .refine((value) => value.toLowerCase() !== "nl-other-nmi", {
                error: "Bron mag niet 'NMI BodemSchat' zijn.",
            }),
        b_sampling_date: z.preprocess(
            (val) => (typeof val === "string" ? new Date(val) : val),
            z.date({
                error: (issue) =>
                    issue.input === undefined
                        ? "Vul een datum in"
                        : "Datum is ongeldig",
            }),
        ),
        a_depth_upper: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Waarde moet een getal zijn",
                })
                .gte(0, "Waarde moet groter of gelijk aan 0 zijn")
                .lte(200, "Waarde moet kleiner of gelijk aan 200 zijn")
                .optional(),
        ),
        a_depth_lower: z.coerce
            .number({
                error: (issue) =>
                    issue.input === undefined
                        ? "Vul in tot hoe diep is bemonsterd"
                        : "Waarde moet een getal zijn",
            })
            .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
            .lte(200, "Waarde moet kleiner of gelijk aan 200 zijn"),
        a_al_ox: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(1000, "Waarde moet kleiner of gelijk aan 1000 zijn")
                .optional(),
        ),
        a_c_of: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(600, "Waarde moet kleiner of gelijk aan 600 zijn")
                .optional(),
        ),
        a_ca_co: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(500, "Waarde moet kleiner of gelijk aan 500 zijn")
                .optional(),
        ),
        a_ca_co_po: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(500, "Waarde moet kleiner of gelijk aan 500 zijn")
                .optional(),
        ),
        a_caco3_if: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(50, "Waarde moet kleiner of gelijk aan 50 zijn")
                .optional(),
        ),
        a_cec_co: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(1000, "Waarde moet kleiner of gelijk aan 1000 zijn")
                .optional(),
        ),
        a_clay_mi: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(75, "Waarde moet kleiner of gelijk aan 75 zijn")
                .optional(),
        ),
        a_cn_fr: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(5, "Waarde moet groter of gelijk aan 5 zijn")
                .lte(40, "Waarde moet kleiner of gelijk aan 40 zijn")
                .optional(),
        ),
        a_com_fr: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.3, "Waarde moet groter of gelijk aan 0.3 zijn")
                .lte(0.8, "Waarde moet kleiner of gelijk aan 0.8 zijn")
                .optional(),
        ),
        a_cu_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(1000, "Waarde moet kleiner of gelijk aan 1000 zijn")
                .optional(),
        ),
        a_density_sa: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.5, "Waarde moet groter of gelijk aan 0.5 zijn")
                .lte(3, "Waarde moet kleiner of gelijk aan 3 zijn")
                .optional(),
        ),
        a_fe_ox: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(1000, "Waarde moet kleiner of gelijk aan 1000 zijn")
                .optional(),
        ),
        a_k_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(600, "Waarde moet kleiner of gelijk aan 600 zijn")
                .optional(),
        ),
        a_k_co: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(150, "Waarde moet kleiner of gelijk aan 150 zijn")
                .optional(),
        ),
        a_k_co_po: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(50, "Waarde moet kleiner of gelijk aan 50 zijn")
                .optional(),
        ),
        a_mg_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(1100, "Waarde moet kleiner of gelijk aan 1100 zijn")
                .optional(),
        ),
        a_mg_co: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(150, "Waarde moet kleiner of gelijk aan 150 zijn")
                .optional(),
        ),
        a_mg_co_po: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(50, "Waarde moet kleiner of gelijk aan 50 zijn")
                .optional(),
        ),
        a_n_pmn: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(500, "Waarde moet kleiner of gelijk aan 500 zijn")
                .optional(),
        ),
        a_n_rt: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(30000, "Waarde moet kleiner of gelijk aan 30000 zijn")
                .optional(),
        ),
        a_nh4_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0, "Waarde moet groter of gelijk aan 0 zijn")
                .lte(500, "Waarde moet kleiner of gelijk aan 500 zijn")
                .optional(),
        ),
        a_no3_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0, "Waarde moet groter of gelijk aan 0 zijn")
                .lte(500, "Waarde moet kleiner of gelijk aan 500 zijn")
                .optional(),
        ),
        a_p_al: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(250, "Waarde moet kleiner of gelijk aan 250 zijn")
                .optional(),
        ),
        a_p_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(100, "Waarde moet kleiner of gelijk aan 100 zijn")
                .optional(),
        ),
        a_p_ox: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(100, "Waarde moet kleiner of gelijk aan 100 zijn")
                .optional(),
        ),
        a_p_rt: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.01, "Waarde moet groter of gelijk aan 0.01 zijn")
                .lte(10, "Waarde moet kleiner of gelijk aan 10 zijn")
                .optional(),
        ),
        a_p_sg: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(100, "Waarde moet kleiner of gelijk aan 100 zijn")
                .optional(),
        ),
        a_p_wa: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(250, "Waarde moet kleiner of gelijk aan 250 zijn")
                .optional(),
        ),
        a_ph_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(3, "Waarde moet groter of gelijk aan 3 zijn")
                .lte(10, "Waarde moet kleiner of gelijk aan 10 zijn")
                .optional(),
        ),
        a_s_rt: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(1, "Waarde moet groter of gelijk aan 1 zijn")
                .lte(10000, "Waarde moet kleiner of gelijk aan 10000 zijn")
                .optional(),
        ),
        a_sand_mi: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(100, "Waarde moet kleiner of gelijk aan 100 zijn")
                .optional(),
        ),
        a_silt_mi: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.1, "Waarde moet groter of gelijk aan 0.1 zijn")
                .lte(100, "Waarde moet kleiner of gelijk aan 100 zijn")
                .optional(),
        ),
        a_som_loi: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(0.5, "Waarde moet groter of gelijk aan 0.5 zijn")
                .lte(75, "Waarde moet kleiner of gelijk aan 75 zijn")
                .optional(),
        ),
        a_zn_cc: z.preprocess(
            (val) => (val === "" ? undefined : val),
            z.coerce
                .number()
                .gte(5, "Waarde moet groter of gelijk aan 5 zijn")
                .lte(50000, "Waarde moet kleiner of gelijk aan 50000 zijn")
                .optional(),
        ),
        b_gwl_class: z.string().optional(),
        b_soiltype_agr: z.string().optional(),
    })
    // .partial()
    .refine(
        (data) => {
            if (
                typeof data.a_depth_upper === "number" &&
                typeof data.a_depth_lower === "number"
            ) {
                return data.a_depth_lower > data.a_depth_upper
            }
            return true
        },
        {
            path: ["a_depth_upper"],
            error: "Bovenkant van bemonsterde laag moet minder diep zijn dan onderkant",
        },
    )
