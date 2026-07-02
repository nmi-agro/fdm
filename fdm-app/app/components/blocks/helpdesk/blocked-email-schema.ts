import z from "zod"

export const AddBlockedEmailSchema = z.object({
  intent: z.literal("add_email_block"),
  email: z.email("Waarde moet een e-mailadres zijn."),
  reason: z.string().optional(),
})

export const RemoveBlockedEmailSchema = z.object({
  intent: z.literal("remove_email_block"),
  email: z.string(),
})
