import z from "zod"

export const FormSchema = z.object({
    b_name: z
        .string({
            error: "Naam van perceel is verplicht",
        })
        .trim()
        .min(3, {
            message: "Naam van perceel moet minimaal 3 karakters bevatten",
        }),
    b_area: z.coerce
        .number({
            error: "Oppervlakte van perceel is verplicht",
        })
        .optional(),
    b_lu_catalogue: z.string({
        error: "Hoofdgewas is verplicht",
    }),
    b_bufferstrip: z.boolean().optional(),
})
