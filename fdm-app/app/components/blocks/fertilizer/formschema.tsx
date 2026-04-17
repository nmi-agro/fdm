import { z } from "zod"

export const FormSchema = z
    .object({
        p_name_nl: z
            .string({
                error: (issue) =>
                    issue.input === undefined
                        ? "Naam is verplicht"
                        : "Ongeldige waarde",
            })
            .trim()
            .min(1, {
                error: "Geef een naam op voor deze meststof",
            }),
        p_name_en: z.string().optional(),
        p_description: z.string().optional(),
        p_type_rvo: z
            .string({
                error: (issue) =>
                    issue.input === undefined
                        ? "RVO mestcode is verplicht"
                        : "Ongeldige waarde",
            })
            .min(1, {
                error: "RVO mestcode mag niet leeg zijn",
            }),
        p_dm: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000, {
                    error: "Waarde mag niet groter zijn dan 1000",
                })
                .optional(),
        ),
        p_density: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0.00016, {
                    error: "Waarde mag niet kleiner dan 0.00016 zijn",
                })
                .max(17.31, {
                    error: "Waarde mag niet groter zijn dan 17.31",
                })
                .optional(),
        ),
        p_om: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000, {
                    error: "Waarde mag niet groter zijn dan 1000",
                })
                .optional(),
        ),
        p_a: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_hc: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_eom: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_eoc: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000, {
                    error: "Waarde mag niet groter zijn dan 1000",
                })
                .optional(),
        ),
        p_c_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_c_of: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_c_if: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_c_fr: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_cn_of: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_n_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000, {
                    error: "Waarde mag niet groter zijn dan 1000",
                })
                .optional(),
        ),
        p_n_if: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_n_of: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_n_wc: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1, {
                    error: "Waarde mag niet groter zijn dan 1",
                })
                .optional(),
        ),
        p_no3_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000, {
                    error: "Waarde mag niet groter zijn dan 1000",
                })
                .optional(),
        ),
        p_nh4_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000, {
                    error: "Waarde mag niet groter zijn dan 1000",
                })
                .optional(),
        ),
        p_p_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(4583, {
                    error: "Waarde mag niet groter zijn dan 4583",
                })
                .optional(),
        ),
        p_k_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(2409.2, {
                    error: "Waarde mag niet groter zijn dan 2409.2",
                })
                .optional(),
        ),
        p_mg_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1659, {
                    error: "Waarde mag niet groter zijn dan 1659",
                })
                .optional(),
        ),
        p_ca_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1399.2, {
                    error: "Waarde mag niet groter zijn dan 1399.2",
                })
                .optional(),
        ),
        p_ne: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_s_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(2497.2, {
                    error: "Waarde mag niet groter zijn dan 2497.2",
                })
                .optional(),
        ),
        p_s_wc: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_cu_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000000, {
                    error: "Waarde mag niet groter zijn dan 1000000",
                })
                .optional(),
        ),
        p_zn_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000000, {
                    error: "Waarde mag niet groter zijn dan 1000000",
                })
                .optional(),
        ),
        p_na_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(2695900, {
                    error: "Waarde mag niet groter zijn dan 2695900",
                })
                .optional(),
        ),
        p_si_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_b_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000000, {
                    error: "Waarde mag niet groter zijn dan 1000000",
                })
                .optional(),
        ),
        p_mn_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000000, {
                    error: "Waarde mag niet groter zijn dan 1000000",
                })
                .optional(),
        ),
        p_ni_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_fe_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_mo_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000000, {
                    error: "Waarde mag niet groter zijn dan 1000000",
                })
                .optional(),
        ),
        p_co_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce
                .number({
                    error: (issue) =>
                        issue.input === undefined
                            ? undefined
                            : "Ongeldige waarde",
                })
                .min(0, {
                    error: "Waarde mag niet negatief zijn",
                })
                .max(1000000, {
                    error: "Waarde mag niet groter zijn dan 1000000",
                })
                .optional(),
        ),
        p_as_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_cd_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_cr_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_cr_vi: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_pb_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_hg_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_cl_rt: z.preprocess(
            (val) => (val === "" || val === null ? undefined : val),
            z.coerce.number().optional(),
        ),
        p_app_method_options: z
            .array(z.string(), {
                error: (issue) =>
                    issue.input === undefined
                        ? "Selecteer minimaal 1 methode"
                        : undefined,
            })
            .prefault([])
            .refine((value) => value.some((item) => item), {
                error: "Selecteer minimaal 1 methode",
            }),
        p_app_amount_unit: z
            .enum(["kg/ha", "l/ha", "m3/ha", "ton/ha"])
            .default("kg/ha"),
    })
    .refine(
        (data) => {
            if (
                data.p_app_amount_unit === "m3/ha" ||
                data.p_app_amount_unit === "l/ha"
            ) {
                return data.p_density !== undefined
            }
            return true
        },
        {
            path: ["p_density"],
            error: "Dichtheid is verplicht bij gebruik van l/ha of m³/ha",
        },
    )
    .refine(
        (data) => {
            if (data.p_n_rt && data.p_n_wc === undefined) {
                return false
            }
            return true
        },
        {
            path: ["p_n_wc"],
            error: "N-werkingscoëfficiënt is verplicht als meststof stikstofbevat",
        },
    )
    .refine(
        (data) => {
            if (
                data.p_n_rt &&
                data.p_no3_rt &&
                data.p_nh4_rt &&
                data.p_no3_rt + data.p_nh4_rt > data.p_n_rt
            ) {
                return false
            }
            if (data.p_n_rt && data.p_no3_rt && data.p_no3_rt > data.p_n_rt) {
                return false
            }
            if (data.p_n_rt && data.p_nh4_rt && data.p_nh4_rt > data.p_n_rt) {
                return false
            }
            return true
        },
        {
            path: ["p_n_rt"],
            error: "De som van nitraat en ammonium kan niet groter zijn dan het totale stikstofgehalte",
        },
    )
