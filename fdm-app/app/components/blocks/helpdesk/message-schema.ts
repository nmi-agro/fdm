import z from "zod"

export const MessageBodySchema = z.string().min(1)
