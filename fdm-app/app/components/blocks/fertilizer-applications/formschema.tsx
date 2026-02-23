import { z } from "zod"

const fields = {
    p_app_amount: z.preprocess(
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
    p_app_method: z.string().min(1, "Toepassingsmethode is verplicht"),
    p_app_date: z.preprocess(
        (val) => (typeof val === "string" ? new Date(val) : val),
        z.date({
            error: (issue) =>
                issue.input === undefined
                    ? "Datum is verplicht"
                    : "Datum is ongeldig",
        }),
    ),
    p_id: z.string({
        // TODO: Validate against the options that are available
        error: (issue) =>
            issue.input === undefined
                ? "Keuze van meststof is verplicht"
                : "Meststof is ongeldig",
    }),
} as const

export const FormSchema = z.object(fields)

export const FormSchemaPartial = z.object(
    Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [
            key,
            value.or(z.undefined()),
        ]),
    ) as {
        [k in keyof typeof fields]: z.ZodUnion<
            [(typeof fields)[k], z.ZodUndefined]
        >
    },
)

export const FormSchemaModify = FormSchema.extend({
    p_app_id: z.string({
        error: (issue) =>
            issue.input === undefined
                ? "Bemesting id is verplicht"
                : "Bemesting id is ongeldig",
    }),
})

export const FormSchemaPartialModify = FormSchemaPartial.extend({
    p_app_id: z.string({
        error: (issue) =>
            issue.input === undefined
                ? "Bemesting id is verplicht"
                : "Bemesting id is ongeldig",
    }),
})

export type FieldFertilizerFormValues = z.infer<typeof FormSchema> & {
    p_app_id?: string | undefined
}
