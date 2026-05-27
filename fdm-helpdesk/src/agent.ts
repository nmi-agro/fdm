import { and, count, desc, eq, sql } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import type { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { getAgentWhereClause } from "./filter"
import type {
    ActivityFilter,
    AgentFilters,
    PaginationFilter,
} from "./filter.types"
import { getPageOffsetAndLimit } from "./pagination"

export type AgentSummary = {
    agent_id: schema.AgentTypeSelect["agent_id"]
    display_name: schema.AgentTypeSelect["display_name"]
}

export type BaseAgent = Omit<schema.AgentTypeSelect, "created" | "updated">
export type Agent = schema.AgentTypeSelect

/**
 * Gets the detailed agent information for the specified agent ID
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param agent_id ID of the agent to get
 * @returns An object containing the agent's information
 *
 * @throws if the agent is not found, or the user has no permission to access this agent's information
 */
export async function getAgent(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    agent_id: schema.AgentTypeSelect["agent_id"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "agent",
            "read",
            agent_id,
            principal_id,
            "getAgent",
        )

        const found = await fdm
            .select()
            .from(schema.agents)
            .where(eq(schema.agents.agent_id, agent_id))

        return found[0]
    } catch (err) {
        throw handleError(err, "Exception for getAgent", {
            principal_id,
            agent_id,
        })
    }
}

/**
 * Gets and filters the list of agents found on the helpdesk
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @returns
 */
export async function getAgents(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    filters: AgentFilters = {},
): Promise<schema.AgentTypeSelect[]> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            principal_id,
            "getAgents",
        )

        const helpdeskWritePermission = await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "getAgents",
            false,
        )

        return (await selectAgents(fdm, false, {
            ...filters,
            ...(helpdeskWritePermission ? {} : { isActive: true }),
            ...getPageOffsetAndLimit(filters),
        })) as schema.AgentTypeSelect[]
    } catch (err) {
        throw handleError(err, "Exception for getAgents", {
            principal_id,
            filters,
        })
    }
}

/**
 * Gets the total number of agents on the helpdesk, with optional pagination unlike { @link getAgents }.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param filters Filters to apply before counting.
 * @returns
 */
export async function getAgentCount(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    filters: ActivityFilter & PaginationFilter,
): Promise<number> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            principal_id,
            "getAgents",
        )

        const helpdeskWritePermission = await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "getAgents",
            false,
        )

        return (
            (
                await selectAgents(fdm, true, {
                    ...filters,
                    ...(helpdeskWritePermission ? {} : { isActive: true }),
                    ...getPageOffsetAndLimit(filters),
                })
            )[0] as { count: number }
        ).count
    } catch (err) {
        throw handleError(err, "Exception for getAgentCount", {
            principal_id,
            filters,
        })
    }
}

async function selectAgents(
    fdm: FdmHelpdeskType,
    selectCount: boolean,
    filters: ActivityFilter & PaginationFilter = {},
) {
    let query = (
        selectCount
            ? fdm.select({ count: count(schema.agents.agent_id) })
            : fdm.select()
    )
        .from(schema.agents)
        .where(getAgentWhereClause(filters))

    if (!selectCount) {
        query = query.orderBy(desc(schema.agents.created)) as typeof query
    }

    if (filters.pageOffset) {
        query = query.offset(filters.pageOffset) as typeof query
    }

    if (filters.pageLimit) {
        query = query.limit(filters.pageLimit) as typeof query
    }

    return await query
}

export async function addAdminAgent(
    fdm: FdmHelpdeskType,
    agent_id: schema.AgentTypeInsert["agent_id"],
    display_name: schema.AgentTypeInsert["display_name"],
) {
    try {
        await fdm.transaction(async (tx) => {
            const found = await tx
                .select({ agent_id: schema.agents.agent_id })
                .from(schema.agents)
                .where(eq(schema.agents.agent_id, agent_id))

            if (found.length > 0) {
                throw new Error("Agent with same ID already exists")
            }

            await tx.insert(schema.agents).values([
                {
                    agent_id: agent_id,
                    display_name: display_name,
                    role: "admin",
                },
            ])
        })

        return agent_id
    } catch (err) {
        throw handleError(err, "Exception for addAdminAgent")
    }
}

export async function addAgent(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    display_name: schema.AgentTypeInsert["display_name"],
): Promise<schema.AgentTypeSelect["agent_id"]> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "addAgent",
        )

        await fdm
            .insert(schema.agents)
            .values([
                {
                    agent_id: agent_id,
                    display_name: display_name,
                    role: "agent",
                    is_active: true,
                },
            ])
            .onConflictDoUpdate({
                target: schema.agents.agent_id,
                set: {
                    display_name: display_name,
                    updated: sql`now()`,
                },
            })

        return agent_id
    } catch (err) {
        throw handleError(err, "Exception for addAgent")
    }
}

export async function updateAgent(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    display_name: schema.AgentTypeInsert["display_name"] | undefined,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            principal_id,
            "updateAgent",
        )
        await fdm
            .update(schema.agents)
            .set({
                display_name: display_name,
                updated: sql`now()`,
            })
            .where(eq(schema.agents.agent_id, agent_id))
    } catch (err) {
        throw handleError(err, "Exception for updateAgent")
    }
}

export async function updateAgentRole(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    role: schema.AgentTypeInsert["role"] | undefined,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "updateAgentRole",
        )

        await fdm.transaction(async (tx) => {
            if (role === "agent") {
                const currentAdmins = await tx
                    .select()
                    .from(schema.agents)
                    .where(
                        and(
                            schema.agents.is_active,
                            eq(schema.agents.role, "admin"),
                        ),
                    )
                    // Limit should be 2 or greater because the first result could be the agent we are changing,
                    // so we still need to check for a second agent that is different
                    .limit(2)

                if (
                    currentAdmins.length === 0 ||
                    (currentAdmins.length === 1 &&
                        currentAdmins[0].agent_id === agent_id)
                ) {
                    throw new Error(
                        "There must be at least one active admin left",
                    )
                }
            }

            await tx
                .update(schema.agents)
                .set({
                    role: role,
                    updated: sql`now()`,
                })
                .where(eq(schema.agents.agent_id, agent_id))
        })
    } catch (err) {
        throw handleError(err, "Exception for updateAgentRole")
    }
}

export async function setAgentActiveStatus(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    agent_id: schema.AgentTypeInsert["agent_id"],
    is_active: schema.AgentTypeInsert["is_active"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "setAgentActiveStatus",
        )

        await fdm.transaction(async (tx) => {
            if (!is_active) {
                const currentAdmins = await tx
                    .select()
                    .from(schema.agents)
                    .where(
                        and(
                            schema.agents.is_active,
                            eq(schema.agents.role, "admin"),
                        ),
                    )
                    // Limit should be 2 or greater because the first result could be the agent we are changing,
                    // so we still need to check for a second agent that is different
                    .limit(2)

                if (
                    currentAdmins.length === 0 ||
                    (currentAdmins.length === 1 &&
                        currentAdmins[0].agent_id === agent_id)
                ) {
                    throw new Error("There must be at least one admin left")
                }
            }

            tx.update(schema.agents)
                .set({
                    is_active: is_active,
                })
                .where(eq(schema.agents.agent_id, agent_id))
        })
    } catch (err) {
        throw handleError(err, "Exception for setAgentActiveStatus")
    }
}
