import { z } from "zod"

export const AccessFormSchema = z.object({
    email: z.email().optional(),
    username: z.string().optional(),
    role: z.enum(["owner", "advisor", "researcher"]).optional(),
    invitation_id: z.string().min(1).optional(),
    intent: z.enum([
        "invite_user",
        "update_role",
        "remove_user",
        "accept_farm_invitation",
        "decline_farm_invitation",
        "accept_organization_invitation",
        "decline_organization_invitation",
    ]),
})
