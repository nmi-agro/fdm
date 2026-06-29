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

export const UpdateAgentSchema = z.object({
  principal_id: z.string().min(1),
  display_name: z.string(),
})

export const SetAgentActiveStatusSchema = z.object({
  principal_id: z.string().min(1),
  is_active: z.coerce
    .string()
    .optional()
    .transform((val) => val === "true"),
})
