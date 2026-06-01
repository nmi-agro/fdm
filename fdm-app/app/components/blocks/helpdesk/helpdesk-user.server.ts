import type { getPrincipals } from "@nmi-agro/fdm-core"
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
    principals: Awaited<ReturnType<typeof getPrincipals>>,
): HelpdeskUser {
    return {
        principal_id: agent.agent_id,
        displayUserName: agent.display_name,
        initials: agent.display_name
            .split(" ")
            .filter((x) => x.length > 0)
            .slice(0, 2)
            .map((x) => x[0].toUpperCase())
            .join(""),
        image: principals.get(agent.agent_id)?.image ?? null,
    }
}
