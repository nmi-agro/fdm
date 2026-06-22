export type HelpdeskRole = "agent" | "admin"
export type ApplicationRole = HelpdeskRole | "user"
export type HelpdeskAction = "read" | "write" | "share"

export type HelpdeskResource =
    // Administration of the helpdesk
    | "helpdesk"
    // Agent-facing ticket details such as assignment status
    | "ticket-agent-side"
    // User-facing ticket details, the user can change these
    | "ticket-user-side"
    // Messages are readable as long as the ticket is readable. Only agents and admins can view internal messages.
    | "message"
    // Agents themselves and their stored data
    | "agent"
    // Saved replies that may be private to the agent
    | "saved_reply"

export type HelpdeskPrincipalId = string | string[]
