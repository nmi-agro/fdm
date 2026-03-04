import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { z } from "zod"

export const FormSchema = z
    .object({
        b_lu_harvest_date: z
            .string({
                error: (issue) =>
                    issue.input === undefined
                        ? "Selecteer een oogstdatum"
                        : "Selecteer een geldige oogstdatum",
            })
            .nullable()
            .transform((val, ctx) => {
                if (val === null) return val
                const date = new Date(val)
                if (Number.isNaN(date.getTime())) {
                    ctx.addIssue({
                        code: "custom",
                        message: "Selecteer een geldige oogstdatum",
                    })
                    return z.NEVER
                }
                return date
            }),
        b_lu_yield: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "De opbrengst (DS) moet een getal zijn",
                })
                .int({
                    message:
                        "De opbrengst (DS) moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "De opbrengst (DS) moet groter zijn dan 0",
                })
                .max(250000, {
                    message:
                        "De opbrengst (DS) mag niet groter zijn dan 250.000 kg DS/ha",
                })
                .optional(),
        ),
        b_lu_yield_fresh: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "De versproduct opbrengst moet een getal zijn",
                })
                .int({
                    message:
                        "De versproduct opbrengst moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "De versproduct opbrengst moet groter zijn dan 0",
                })
                .max(250000, {
                    message:
                        "De versproduct opbrengst mag niet groter zijn dan 250.000 kg versproduct/ha",
                })
                .optional(),
        ),
        b_lu_yield_bruto: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "De bruto opbrengst (incl. tarra) moet een getal zijn",
                })
                .int({
                    message:
                        "De bruto opbrengst (incl. tarra) moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message:
                        "De bruto opbrengst (incl. tarra) moet groter zijn dan 0",
                })
                .max(250000, {
                    message:
                        "De bruto opbrengst mag niet groter zijn dan 250.000 kg versproduct (incl. tarra)/ha",
                })
                .optional(),
        ),
        b_lu_dm: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "Het droge stofgehalte moet een getal zijn",
                })
                .int({
                    message:
                        "Het droge stofgehalte moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "Het droge stofgehalte moet groter zijn dan 0",
                })
                .max(1000, {
                    message:
                        "Het droge stofgehalte mag niet groter zijn dan 1.000 g/kg",
                })
                .optional(),
        ),
        b_lu_n_harvestable: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "De stikstofopbrengst moet een getal zijn",
                })
                .positive({
                    message: "De stikstofopbrengst moet groter zijn dan 0",
                })
                .max(1000, {
                    message:
                        "De stikstofopbrengst mag niet groter zijn dan 1.000 kg N/ha",
                })
                .optional(),
        ),
        b_lu_tarra: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "Het tarra-percentage moet een getal zijn",
                })
                .int({
                    message:
                        "Het tarra-percentage moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "Het tarra-percentage moet groter zijn dan 0",
                })
                .max(25, {
                    message: "Het tarra-percentage mag niet hoger zijn dan 25%",
                })
                .optional(),
        ),
        b_lu_uww: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "Het onderwatergewicht moet een getal zijn",
                })
                .int({
                    message:
                        "Het onderwatergewicht moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "Het onderwatergewicht moet groter zijn dan 0",
                })
                .min(100, {
                    message:
                        "Het onderwatergewicht mag niet kleiner zijn dan 100 g / 5 kg",
                })
                .max(1000, {
                    message:
                        "Het onderwatergewicht mag niet groter zijn dan 1.000 g / 5 kg",
                })
                .optional(),
        ),
        b_lu_moist: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "Het vochtpercentage moet een getal zijn",
                })
                .int({
                    message:
                        "Het vochtpercentage moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "Het vochtpercentage moet groter zijn dan 0",
                })
                .max(100, {
                    message: "Het vochtpercentage mag niet hoger zijn dan 100%",
                })
                .optional(),
        ),
        b_lu_cp: z.preprocess(
            (val) =>
                val === ""
                    ? undefined
                    : typeof val === "string"
                      ? Number(val)
                      : val,
            z
                .number({
                    error: "Het ruw eiwitgehalte moet een getal zijn",
                })
                .int({
                    message:
                        "Het ruw eiwitgehalte moet een geheel getal zijn (zonder decimalen)",
                })
                .positive({
                    message: "Het ruw eiwitgehalte moet groter zijn dan 0",
                })
                .max(500, {
                    message:
                        "Het ruw eiwitgehalte mag niet groter zijn dan 500 g/kg DS",
                })
                .optional(),
        ),
        b_lu_start: z.preprocess(
            (val) => (typeof val === "string" ? new Date(val) : val),
            z.date().optional().nullable(),
        ),
        b_lu_end: z.preprocess(
            (val) => (typeof val === "string" ? new Date(val) : val),
            z.date().optional().nullable(),
        ),
        b_lu_harvestable: z.enum(["once", "multiple", "none"]),
    })
    .superRefine((data, ctx) => {
        if (
            data.b_lu_start &&
            data.b_lu_harvest_date &&
            data.b_lu_harvest_date <= data.b_lu_start
        ) {
            ctx.addIssue({
                code: "custom",
                message: `De oogstdatum mag niet vóór de start van de teelt (${format(data.b_lu_start, "PP", { locale: nl })}) vallen`,
                path: ["b_lu_harvest_date"],
            })
        }
        if (
            data.b_lu_end &&
            data.b_lu_harvest_date &&
            data.b_lu_harvest_date > data.b_lu_end &&
            data.b_lu_harvestable === "multiple"
        ) {
            ctx.addIssue({
                code: "custom",
                message: `De oogstdatum mag niet ná het einde van de teelt (${format(data.b_lu_end, "PP", { locale: nl })}) vallen`,
                path: ["b_lu_harvest_date"],
            })
        }
    })
