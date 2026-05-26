import z from "zod"

export const MessageBodySchema = z.string().min(1)

export const MessageSchema = z.object({
    intent: z.string().optional(),
    body: MessageBodySchema,
})
