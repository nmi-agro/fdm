import { z } from "zod"

export const MeasureDateSchema = z.object({
    m_start: z.string().min(1, "Startdatum is verplicht"),
    m_end: z.string().nullable(),
})

export type MeasureDateFormValues = z.infer<typeof MeasureDateSchema>
