import { z } from "zod"

const FormSchema = z.object({
    b_name: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? "Naam van perceel is verplicht"
                    : undefined,
        })
        .trim()
        .min(3, {
            error: "Naam van perceel moet minimaal 3 karakters bevatten",
        }),
    b_lu_catalogue: z.string({
        error: (issue) =>
            issue.input === undefined ? "Hoofdgewas is verplicht" : undefined,
    }),
    b_id_source: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? "ID van bron is verplicht"
                    : undefined,
        })
        .optional(),
    b_geometry: z
        .string({
            error: (issue) =>
                issue.input === undefined
                    ? "Geometrie van perceel is verplicht"
                    : undefined,
        })
        .optional(),
})

export { FormSchema }
