import z from "zod"

export const AddBlockedEmailSchema = z.object({
  intent: z.literal("add_email_block"),
  email: z.email("Waarde moet een e-mailadres of domeinnaam zijn.").or(
    z.string().regex(
      // Custom regex based on z.hostname(), that can also match "*." at the beginning
      /^(\*\.)?(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/,
      "Waarde moet een e-mailadres of domeinnaam zijn.",
    ),
  ),
  reason: z.string().optional(),
})

export const RemoveBlockedEmailSchema = z.object({
  intent: z.literal("remove_email_block"),
  email: z.string(),
})
