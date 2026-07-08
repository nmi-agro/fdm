import z from "zod"

export const MessageBodySchema = z.string().trim().min(1)

export const MessageSchema = z.object({
  intent: z.string().optional(),
  body: MessageBodySchema,
  sender_role: z.enum(["agent", "customer"]).optional(),
  is_internal: z.boolean().optional(),
})
