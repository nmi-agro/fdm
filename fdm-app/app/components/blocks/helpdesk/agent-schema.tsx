import z from "zod"

export const AddAgentSchema = z.object({
    principal_id: z.string().min(1),
    role: z.string(),
})

export const UpdateAgentRoleSchema = z.object({
    principal_id: z.string().min(1),
    role: z.string(),
})

export const UpdateAgentSchema = z.object({
    principal_id: z.string().min(1),
    display_name: z.string(),
})

export const SetAgentActiveStatusSchema = z.object({
    principal_id: z.string().min(1),
    is_active: z.coerce.boolean(),
})
