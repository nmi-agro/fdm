import { z } from "zod"

export const MeasureDateSchema = z.object({
  m_start: z.string().min(1, "Startdatum is verplicht"),
  m_end: z.string().min(1, "Einddatum is verplicht").nullable(),
})

export type MeasureDateFormValues = z.infer<typeof MeasureDateSchema>
