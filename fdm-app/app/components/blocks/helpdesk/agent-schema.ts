import z from "zod"

const AgentRoleSchema = z.enum(["agent", "admin"])

export const AddAgentSchema = z.object({
  principal_id: z.string().min(1),
  role: AgentRoleSchema,
})

export const UpdateAgentRoleSchema = z.object({
  principal_id: z.string().min(1),
  role: AgentRoleSchema,
})

type AssignmentTier = 1 | 2 | 3
export const UpdateAgentSchema = z.object({
  agent_id: z.string().min(1),
  display_name: z.string(),
  availability_status: z.enum(["online", "away", "out-of-office"]),
  max_tickets: z
    .preprocess(
      (val) => (val === "" ? undefined : typeof val === "string" ? Number(val) : val),
      z
        .number({
          error: "Dit moet een getal zijn.",
        })
        .int({
          error: "Dit moet een hele getal zijn.",
        })
        .positive({
          error: "Jij moet meer dan 0 tickets kunnen verwerken.",
        }),
    )
    .nullable()
    .optional(),
  work_days: z.array(z.number().min(0).max(6)),
  assignment_tier: z
    .preprocess(
      (val) => (val === "" ? undefined : typeof val === "string" ? Number.parseInt(val, 10) : val),
      z
        .literal(1 as AssignmentTier)
        .or(z.literal(2 as AssignmentTier))
        .or(z.literal(3 as AssignmentTier)),
    )
    .optional(),
  reassign_tickets: z.boolean(),
})

export const SetAgentActiveStatusSchema = z.object({
  principal_id: z.string().min(1),
  is_active: z.coerce
    .string()
    .optional()
    .transform((val) => val === "true"),
})
