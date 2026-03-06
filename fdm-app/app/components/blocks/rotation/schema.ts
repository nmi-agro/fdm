import { z } from "zod"

export const RotationTableFormSchema = z
    .object({
        b_lu_start: z.preprocess((value) => {
            if (typeof value === "string") {
                if (value.toLowerCase() === "null") return null
            }
            return value
        }, z.coerce.date().optional().nullable()),
        b_lu_end: z.preprocess((value) => {
            if (typeof value === "string") {
                if (value.toLowerCase() === "null") return null
            }
            return value
        }, z.coerce.date().optional().nullable()),
        m_cropresidue: z.preprocess((value) => {
            if (typeof value === "string") {
                if (value.toLowerCase() === "false") return false
                if (value.toLowerCase() === "true") return true
                if (value.toLowerCase() === "null") return null
            }
            return value
        }, z.coerce.boolean().optional().nullable()),
        b_lu_variety: z.preprocess((value) => {
            if (typeof value === "string") {
                if (value.toLowerCase() === "null") return null
            }
            return value
        }, z.string().optional().nullable()),
    })
    .refine(
        (data) => {
            if (data.b_lu_start && data.b_lu_end) {
                return data.b_lu_end > data.b_lu_start
            }
            return true
        },
        {
            path: ["b_lu_end"],
            error: "Einddatum moet na de zaaidatum liggen.",
        },
    )

export type RotationTableFormSchemaType = z.infer<
    typeof RotationTableFormSchema
>
