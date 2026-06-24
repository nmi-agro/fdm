import z from "zod"
import { MessageBodySchema } from "./message-schema"

export const TicketSchema = z.object({
    context_farm_id: z
        .string()
        .transform((id) => (id === "" ? undefined : id))
        .nullable()
        .optional(),
    body: MessageBodySchema,
})

export const TicketSubjectSchema = z
    .string("Ongeldig onderwerp")
    .trim()
    .min(1, "Ongeldig onderwerp")

export const TicketPrioritySchema = z.enum(["low", "normal", "high", "urgent"])
