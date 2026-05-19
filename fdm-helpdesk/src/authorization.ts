import { and, eq, inArray, isNotNull, not, or, sql } from "drizzle-orm"
import type {
    ApplicationRole,
    HelpdeskAction,
    HelpdeskPrincipalId,
    HelpdeskResource,
} from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"

export const helpdeskRoles: ApplicationRole[] = ["agent", "admin"]
export const helpdeskActions = ["read", "write", "share"] as const

/**
 * Checks whether the principal is authorized to perform an action on a resource.
 *
 * This function retrieves the least privileged common role of the given principals and checks if this role
 * is granted permission to perform the specified action on the resource.
 * `strict` may be specified as false in order to disable the exception.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param resource - The type of resource being accessed.
 * @param action - The action the principal intends to perform.
 * @param resource_id - The unique identifier of the specific resource.
 * @param principal_id - The principal identifier(s); supports a single ID or an array.
 * @param origin - The source origin used for audit logging the permission check.
 * @param strict - When set to false, the function will not perform an audit log, or throw an exception if the
 * user has no permission.
 * @returns Resolves to true if the principal is permitted to perform the action.
 *
 * @throws {Error} When the principal does not have the required permission or a database transaction fails.
 */
export async function checkHelpdeskPermission(
    fdm: FdmHelpdeskType,
    resource: HelpdeskResource,
    action: HelpdeskAction,
    resource_id: string,
    principal_id: HelpdeskPrincipalId,
    _origin: string,
    strict = true,
) {
    try {
        const permission = await getHelpdeskPermission(
            fdm,
            resource,
            action,
            resource_id,
            principal_id,
        )

        // Throw exception if strict
        if (strict && !permission) {
            throw new Error("Permission denied")
        }

        return !!permission
    } catch (err) {
        let message = "Exception for checkPermission"
        if (err instanceof Error && err.message === "Permission denied") {
            message =
                "Principal does not have permission to perform this action"
        }
        throw handleError(err, message, {
            resource: resource,
            action: action,
            resource_id: resource_id,
            principal_id: principal_id,
        })
    }
}

/**
 * Gets the least-privileged role on the helpdesk for the given principals.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id - The principal identifier(s); supports a single ID or an array.
 * @returns a string indicating a role that all of the principals can assume.
 *
 * @throws {Error} When a database transaction fails.
 */
export async function getHelpdeskRole(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
): Promise<ApplicationRole> {
    const principal_ids = [
        ...new Set(Array.isArray(principal_id) ? principal_id : [principal_id]),
    ]

    const agents = await fdm
        .select({ role: schema.agents.role })
        .from(schema.agents)
        .where(inArray(schema.agents.agent_id, principal_ids))

    if (agents.length < principal_ids.length) return "user"

    return agents.every((a) => a.role === "admin")
        ? "admin"
        : agents.some((a) => a.role === "agent")
          ? "agent"
          : "user"
}

/**
 * Gets the granting resource type and ID if the principal has permission to perform the action in the given
 * resource.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer}.
 * @param resource - The type of resource being accessed.
 * @param action - The action the principal intends to perform.
 * @param resource_id - The unique identifier of the specific resource.
 * @param principal_id - The principal identifier(s); supports a single ID or an array.
 * @param origin - The source origin used for audit logging the permission check.
 * @returns `granting_resource` is the resource type, `granting_resource_id` is the id of the specific
 * granting resource.
 * `null` is returned if the principal does not have the permission.
 *
 * @throws {Error} When a database transaction fails.
 */
export async function getHelpdeskPermission(
    fdm: FdmHelpdeskType,
    resource: HelpdeskResource,
    action: HelpdeskAction,
    resource_id: string,
    principal_id: HelpdeskPrincipalId,
): Promise<{
    granting_resource: HelpdeskResource
    granting_resource_id?: string
} | null> {
    const principal_ids = Array.isArray(principal_id)
        ? principal_id
        : [principal_id]

    const role = await getHelpdeskRole(fdm, principal_id)

    // Helpdesk management
    if (resource === "helpdesk") {
        const value: Awaited<ReturnType<typeof getHelpdeskPermission>> =
            action !== "read" && role === "admin"
                ? { granting_resource: "helpdesk" }
                : action === "read" && helpdeskRoles.includes(role)
                  ? { granting_resource: "helpdesk" }
                  : null
        return value
    }

    // Agent's own data
    if (resource === "agent") {
        if (
            (
                await fdm
                    .select()
                    .from(schema.agents)
                    .where(eq(schema.agents.agent_id, resource_id))
                    .limit(1)
            ).length > 0
        ) {
            return helpdeskRoles.includes(role) &&
                (action === "read" ||
                    role === "admin" ||
                    (principal_ids.length > 0 &&
                        principal_ids.every(
                            (principal_id) => principal_id === resource_id,
                        )))
                ? {
                      granting_resource: "agent",
                      granting_resource_id: resource_id,
                  }
                : null
        }

        return null
    }

    // Agent's saved replies
    if (resource === "saved_reply") {
        if (!helpdeskRoles.includes(role)) {
            return null
        }

        return helpdeskRoles.includes(role) &&
            (
                await fdm
                    .select()
                    .from(schema.savedReplies)
                    .where(
                        or(
                            action === "read"
                                ? schema.savedReplies.is_shared
                                : sql`false`,
                            inArray(
                                schema.savedReplies.created_by,
                                principal_ids,
                            ),
                        ),
                    )
                    .limit(1)
            ).length > 0
            ? {
                  granting_resource: "saved_reply",
                  granting_resource_id: resource_id,
              }
            : null
    }

    // Ticket
    if (resource === "ticket-user-side" || resource === "ticket-agent-side") {
        const agentStatus = await fdm
            .select({ is_active: schema.agents.is_active })
            .from(schema.agents)
            .where(inArray(schema.agents.agent_id, principal_ids))
        const isActiveAgent =
            agentStatus.length === principal_ids.length &&
            agentStatus.every((stat) => stat.is_active)
        const isAdmin = role === "admin"

        // Users can't modify ticket assignments etc. but they can see this status on their own tickets
        if (
            action !== "read" &&
            resource === "ticket-agent-side" &&
            (!isActiveAgent || !helpdeskRoles.includes(role))
        ) {
            return null
        }

        return (
            await fdm
                .select()
                .from(schema.tickets)
                .where(
                    and(
                        eq(schema.tickets.ticket_id, resource_id),
                        !isActiveAgent && !isAdmin
                            ? and(
                                  isNotNull(schema.tickets.requester_id),
                                  inArray(
                                      schema.tickets.requester_id,
                                      principal_ids,
                                  ),
                              )
                            : undefined,
                    ),
                )
                .limit(1)
        ).length > 0
            ? {
                  granting_resource: resource,
                  granting_resource_id: resource_id,
              }
            : null
    }

    // Message
    if (resource === "message") {
        const agentStatus = await fdm
            .select({ is_active: schema.agents.is_active })
            .from(schema.agents)
            .where(and(inArray(schema.agents.agent_id, principal_ids)))
        const isActiveAgent =
            agentStatus.length === principal_ids.length &&
            agentStatus.every((stat) => stat.is_active)
        const isAdmin = role === "admin"

        return (
            await fdm
                .select()
                .from(schema.messages)
                .leftJoin(
                    schema.tickets,
                    eq(schema.messages.ticket_id, schema.tickets.ticket_id),
                )
                .where(
                    and(
                        eq(schema.messages.message_id, resource_id),
                        // Users and regular agents can only modify their own messages
                        action === "write" && !isAdmin
                            ? inArray(schema.messages.sender_id, principal_ids)
                            : undefined,
                        // Regular users can only view non-internal messages under their own tickets
                        !isActiveAgent && !isAdmin
                            ? and(
                                  not(schema.messages.is_internal),
                                  isNotNull(schema.tickets.requester_id),
                                  inArray(
                                      schema.tickets.requester_id,
                                      principal_ids,
                                  ),
                              )
                            : undefined,
                    ),
                )
                .limit(1)
        ).length > 0
            ? {
                  granting_resource: "message",
                  granting_resource_id: resource_id,
              }
            : null
    }

    return null
}
