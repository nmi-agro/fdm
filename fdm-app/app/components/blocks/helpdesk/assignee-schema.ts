import z from "zod"

export const AssigneeSchema = z.object({
    primary: z.array(z.string().min(1)),
    assignees: z.array(z.string().min(1)),
})
