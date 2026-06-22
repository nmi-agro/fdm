import { Headset, User } from "lucide-react"
import { cn } from "@/app/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import type { HelpdeskUser } from "./types"

/**
 * Converts an AgentTypeSelect and a principals map to a HelpdeskUser, which is used in the frontend for displaying agents.
 *
 * @param agent agent to convert
 * @param principals principals to look for the profile picture
 * @returns a HelpdeskUser object
 */
export function makeHelpdeskUser(
    agent: { agent_id: string; display_name: string },
    principals: Map<string, { image?: string | null }>,
): HelpdeskUser {
    return {
        principal_id: agent.agent_id,
        displayUserName: agent.display_name,
        initials: null,
        image: principals.get(agent.agent_id)?.image ?? null,
        icon: "agent",
    }
}

/**
 * A HelpdeskUser's avatar. It handles the icon override and fallback display.
 */
export function HelpdeskUserAvatar({
    user,
    type = "customer",
    className,
}: {
    user?: HelpdeskUser | null
    type?: string
    className?: string
}) {
    const agentIcon = <Headset className="size-3/4" />
    const customerIcon = <User />
    return (
        <Avatar className={cn("size-6 text-muted-foreground", className)}>
            <AvatarImage
                src={user?.image ?? undefined}
                alt={
                    user?.displayUserName ??
                    (type === "agent"
                        ? "Onbekende medewerker"
                        : "Onbekende gebruiker")
                }
            />
            <AvatarFallback>
                {user?.icon
                    ? user.icon === "agent"
                        ? agentIcon
                        : customerIcon
                    : (user?.initials ??
                      (type === "agent" ? agentIcon : customerIcon))}
            </AvatarFallback>
        </Avatar>
    )
}
