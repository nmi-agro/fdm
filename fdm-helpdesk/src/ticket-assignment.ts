import { and, asc, eq, inArray, isNull, not, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { checkHelpdeskPermission } from "./authorization"
import type { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { getTicketWhereClause } from "./filter"
import type { TicketFilters } from "./filter.types"
import { createId } from "./id"

/** Summary of a single ticket assignment, joining the agent's display name. */
export type TicketAssignmentSummary = {
    agent_id: schema.TicketAssignmentTypeSelect["agent_id"]
    display_name: schema.AgentTypeSelect["display_name"]
    is_primary: schema.TicketAssignmentTypeSelect["is_primary"]
}
const ticketAssignmentSummaryColumns = {
    agent_id: schema.ticketAssignments.agent_id,
    display_name: schema.agents.display_name,
    is_primary: schema.ticketAssignments.is_primary,
}

/**
 * Retrieves the current (non-unassigned) assignees for a batch of tickets, grouped by ticket ID.
 * Requires user-side read permission for each ticket.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have user-side read permission for each ticket.
 * @param ticket_ids IDs of the tickets whose assignees to fetch.
 * @returns A Map from ticket ID to an array of {@link TicketAssignmentSummary} objects.
 */
export async function getAssigneesForTickets(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    ticket_ids: string[],
): Promise<
    Map<schema.TicketTypeSelect["ticket_id"], TicketAssignmentSummary[]>
> {
    await Promise.all(
        ticket_ids.map((ticket_id) =>
            checkHelpdeskPermission(
                fdm,
                "ticket-user-side",
                "read",
                ticket_id,
                principal_id,
                "getAssigneesForTickets",
            ),
        ),
    )

    const allAssignees = await fdm
        .select({
            ticket_id: schema.ticketAssignments.ticket_id,
            ...ticketAssignmentSummaryColumns,
        })
        .from(schema.ticketAssignments)
        .innerJoin(
            schema.agents,
            eq(schema.ticketAssignments.agent_id, schema.agents.agent_id),
        )
        .where(
            and(
                inArray(schema.ticketAssignments.ticket_id, ticket_ids),
                isNull(schema.ticketAssignments.unassigned_at),
            ),
        )
        .orderBy(
            schema.ticketAssignments.ticket_id,
            asc(schema.agents.display_name),
        )

    const result = new Map<
        schema.TicketTypeSelect["ticket_id"],
        TicketAssignmentSummary[]
    >()

    for (const relatedAssignee of allAssignees) {
        const { ticket_id, ...assignment } = relatedAssignee
        const existing = result.get(ticket_id)
        if (existing) {
            existing.push(assignment)
        } else {
            result.set(ticket_id, [assignment])
        }
    }

    return result
}

/**
 * Returns the full assignment history for a ticket (all assign and unassign events).
 * Requires user-side read permission for the ticket.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have user-side read permission for the ticket.
 * @param ticket_id ID of the ticket whose assignment history to fetch.
 * @returns An array of assignment records ordered by `assigned_at` ascending.
 */
export async function getAssignmentHistoryForTicket(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    ticket_id: string,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "read",
            ticket_id,
            principal_id,
            "getAssignmentHistoryForTicket",
        )

        return await fdm
            .select()
            .from(schema.ticketAssignments)
            .where(eq(schema.ticketAssignments.ticket_id, ticket_id))
            .orderBy(
                asc(schema.ticketAssignments.assigned_at),
                asc(schema.ticketAssignments.assignment_id),
            )
    } catch (err) {
        throw handleError(err, "Exception for getAssigneeHistoryForTicket", {
            principal_id,
            ticket_id,
        })
    }
}

/**
 * Assigns an agent to a ticket. If the agent is already assigned, updates the `is_primary` flag.
 * When `is_primary` is `true`, all other current assignees are demoted to non-primary.
 * Requires agent-side write permission for the ticket.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket to assign the agent to.
 * @param agent_id ID of the agent to assign.
 * @param assigned_by ID of the principal performing the assignment; must have agent-side write permission.
 * @param is_primary Whether to make this agent the primary assignee. Defaults to `false`.
 */
export async function assignTicket(
    fdm: FdmHelpdeskType,
    ticket_id: schema.TicketAssignmentTypeInsert["ticket_id"],
    agent_id: schema.TicketAssignmentTypeInsert["agent_id"],
    assigned_by: schema.TicketAssignmentTypeInsert["assigned_by"],
    is_primary = false,
) {
    await fdm.transaction(async (tx) => {
        // Check if the agent is allowed to modify this ticket
        await checkHelpdeskPermission(
            tx,
            "ticket-agent-side",
            "write",
            ticket_id,
            assigned_by,
            "assignTicket",
        )

        // If a new primary assignee is set, make other assignments non-primary
        if (is_primary) {
            await tx
                .update(schema.ticketAssignments)
                .set({ is_primary: false, updated_at: sql`now()` })
                .where(
                    and(
                        eq(schema.ticketAssignments.ticket_id, ticket_id),
                        isNull(schema.ticketAssignments.unassigned_at),
                        not(eq(schema.ticketAssignments.agent_id, agent_id)),
                    ),
                )
        }

        const existing = await tx
            .select()
            .from(schema.ticketAssignments)
            .where(
                and(
                    eq(schema.ticketAssignments.ticket_id, ticket_id),
                    eq(schema.ticketAssignments.agent_id, agent_id),
                    isNull(schema.ticketAssignments.unassigned_at),
                ),
            )

        if (existing.length > 0) {
            await tx
                .update(schema.ticketAssignments)
                .set({
                    is_primary: is_primary,
                    updated_at: sql`now()`,
                })
                .where(
                    eq(
                        schema.ticketAssignments.assignment_id,
                        existing[0].assignment_id,
                    ),
                )
        } else {
            const assignment_id = createId()
            await tx.insert(schema.ticketAssignments).values([
                {
                    assignment_id: assignment_id,
                    ticket_id: ticket_id,
                    agent_id: agent_id,
                    assigned_by: assigned_by,
                    is_primary: is_primary,
                },
            ])
        }
    })
}

/**
 * Removes an agent's active assignment from a ticket by setting `unassigned_at`.
 * Requires agent-side write permission for the ticket.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket to unassign the agent from.
 * @param agent_id ID of the agent to unassign.
 * @param unassigned_by ID of the principal performing the unassignment; must have agent-side write permission.
 * @returns `true` if an active assignment was found and removed, `false` if the agent was not assigned.
 */
export async function unassignTicket(
    fdm: FdmHelpdeskType,
    ticket_id: schema.TicketAssignmentTypeInsert["ticket_id"],
    agent_id: schema.TicketAssignmentTypeInsert["agent_id"],
    unassigned_by: schema.TicketAssignmentTypeInsert["assigned_by"],
) {
    return await fdm.transaction(async (tx) => {
        // Check if the agent is allowed to modify this ticket
        await checkHelpdeskPermission(
            tx,
            "ticket-agent-side",
            "write",
            ticket_id,
            unassigned_by,
            "unassignTicket",
        )

        // Mark the assignment as unassigned by setting the unassigned_at timestamp
        const deleted = await tx
            .update(schema.ticketAssignments)
            .set({ unassigned_at: sql`now()`, unassigned_by: unassigned_by })
            .where(
                and(
                    eq(schema.ticketAssignments.ticket_id, ticket_id),
                    eq(schema.ticketAssignments.agent_id, agent_id),
                    isNull(schema.ticketAssignments.unassigned_at),
                ),
            )
            .returning({
                assignment_id: schema.ticketAssignments.assignment_id,
            })

        return deleted.length > 0
    })
}

/**
 * Returns a map of ticket counts per agent, filtered by the provided ticket filters.
 * Only counts tickets with an active (non-unassigned) assignment.
 * Requires helpdesk read permission.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have helpdesk read permission.
 * @param agent_ids IDs of the agents to count tickets for.
 * @param ticketFilters Ticket filters to apply before counting.
 * @returns A Map from agent ID to the number of matching tickets assigned to that agent.
 */
export async function getTicketCountsForAssignees(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    agent_ids: schema.TicketAssignmentTypeSelect["agent_id"][],
    ticketFilters: TicketFilters,
): Promise<Map<schema.TicketAssignmentTypeSelect["agent_id"], number>> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            principal_id,
            "getTicketCountsForAssignees",
        )

        const aliasedTicketAssignments = alias(
            schema.ticketAssignments,
            "GROUP_COLUMN",
        )
        const entries = await fdm
            .select({
                agent_id: aliasedTicketAssignments.agent_id,
                count: sql<number>`cast(count(distinct ${aliasedTicketAssignments.ticket_id}) as integer)`,
            })
            .from(aliasedTicketAssignments)
            .innerJoin(
                schema.tickets,
                eq(
                    aliasedTicketAssignments.ticket_id,
                    schema.tickets.ticket_id,
                ),
            )
            .leftJoin(
                schema.ticketTagsMap,
                eq(schema.tickets.ticket_id, schema.ticketTagsMap.ticket_id),
            )
            .leftJoin(
                schema.ticketViews,
                and(eq(schema.ticketViews.ticket_id, schema.tickets.ticket_id)),
            )
            .where(
                and(
                    inArray(aliasedTicketAssignments.agent_id, agent_ids),
                    isNull(aliasedTicketAssignments.unassigned_at),
                    getTicketWhereClause(fdm, ticketFilters),
                ),
            )
            .groupBy(aliasedTicketAssignments.agent_id)
        return new Map(entries.map((ent) => [ent.agent_id, ent.count]))
    } catch (err) {
        throw handleError(err, "Exception for getTicketCountsForAssignees", {
            principal_id,
            agent_ids,
            ticketFilters,
        })
    }
}
