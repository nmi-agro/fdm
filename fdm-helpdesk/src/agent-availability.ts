import {
    and,
    asc,
    eq,
    gte,
    inArray,
    isNull,
    lt,
    lte,
    notExists,
    or,
    sql,
} from "drizzle-orm"
import type { AgentSummary } from "./agent"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import { ACTIVE_TICKET_STATUSES, getTickets, type Ticket } from "./ticket"
import {
    assignTicketUnchecked,
    type TicketAssignmentSummary,
} from "./ticket-assignment"

export type TicketReassignment = TicketAssignmentSummary & {
    ticket: Ticket
}

const agentSummaryColumns = {
    agent_id: schema.agents.agent_id,
    display_name: schema.agents.display_name,
    role: schema.agents.role,
    is_active: schema.agents.is_active,
    availability_status: schema.agents.availability_status,
    assignment_tier: schema.agents.assignment_tier,
    work_days: schema.agents.work_days,
    max_tickets: schema.agents.max_tickets,
    created: schema.agents.created,
    updated: schema.agents.updated,
}

/**
 * Get available agents on the given date, in increasing tier order, and then in decreasing total assigned ticket weight
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param date Date on which to check the agent availabilites for.
 * @returns List of agents who are available
 */
export async function getAvailableAgents(
    fdm: FdmHelpdeskType,
    date: Date,
): Promise<AgentSummary[]> {
    try {
        return await fdm
            .select({
                ...agentSummaryColumns,
                // Total "weight" of all active tickets that this agent is assigned to
                total_assigned_weight: sql`(select sum(CASE tickets.priority
        WHEN 'low' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'high' THEN 4
        WHEN 'urgent' THEN 8
        ELSE 3
    END) FROM ${schema.ticketAssignments}
    JOIN ${schema.tickets}
      ON ${schema.ticketAssignments.ticket_id} = ${schema.tickets.ticket_id}
    WHERE
        ${schema.ticketAssignments.agent_id} = ${schema.agents.agent_id}
      AND ${inArray(schema.tickets.status, ACTIVE_TICKET_STATUSES)})`,
                // Number of active tickets that this agent is assigned to
                num_assigned_tickets: sql`(select count(*)
from ${schema.ticketAssignments}
inner join ${schema.tickets} on ${schema.ticketAssignments.ticket_id} = ${schema.tickets.ticket_id}
where ${schema.ticketAssignments.agent_id} = ${schema.agents.agent_id}
and ${inArray(schema.tickets.status, ACTIVE_TICKET_STATUSES)})`,
            })
            .from(schema.agents)
            .where((t) =>
                and(
                    // Is the agent active?
                    eq(schema.agents.is_active, true),
                    // Is the agent online?
                    eq(schema.agents.availability_status, "online"),
                    // Is the agent free on this day of the week?
                    sql`${schema.agents.work_days} @> ${date.getDay().toString()}::jsonb`,
                    // Is the agent absent on this day?
                    notExists(
                        fdm
                            .select({
                                absence_id: schema.agentAbsences.absence_id,
                            })
                            .from(schema.agentAbsences)
                            .where(
                                and(
                                    eq(
                                        schema.agentAbsences.agent_id,
                                        schema.agents.agent_id,
                                    ),
                                    lte(schema.agentAbsences.start_date, date),
                                    gte(schema.agentAbsences.end_date, date),
                                ),
                            ),
                    ),
                    // Does the agent have capacity for more tickets?
                    or(
                        isNull(schema.agents.max_tickets),
                        lt(t.num_assigned_tickets, schema.agents.max_tickets),
                    ),
                ),
            )
            .orderBy((t) => [
                asc(schema.agents.assignment_tier),
                asc(t.num_assigned_tickets),
                asc(t.total_assigned_weight),
                asc(schema.agents.display_name),
            ])
    } catch (err) {
        throw handleError(err, "Exception for getAvailableAgents", {
            date: date.toISOString(),
        })
    }
}

/**
 * Auto-assign to least-loaded available agent (respects tier cascade) as the primary assignment.
 *
 * No permission checks are performed, and assigned_by is set to "SYSTEM". Use with caution.
 *
 * This function will always assign when there is a currently available agent, even if the ticket is
 * already assigned. It will also change the primary assignee to the newly assigned agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id Ticket ID to assign.
 * @param date Date on which to check the agent availabilites for.
 * @returns If assignment succeeded, assigned: true and agent_id is the ID of the agent assigned.
 * If no agents were available, assigned: false.
 */
export async function autoAssignTicket(
    fdm: FdmHelpdeskType,
    ticket_id: string,
    date: Date,
) {
    try {
        const availableAgents = await getAvailableAgents(fdm, date)
        if (availableAgents.length > 0) {
            const agentToAssign = availableAgents[0]
            await assignTicketUnchecked(
                fdm,
                ticket_id,
                agentToAssign.agent_id,
                "SYSTEM",
                true,
            )
            return { assigned: true, agent_id: agentToAssign.agent_id } as const
        }
        return { assigned: false, agent_id: undefined as never } as const
    } catch (err) {
        throw handleError(err, "Exception for autoAssignTicket", {
            ticket_id,
            date: date.toISOString(),
        })
    }
}

/**
 * Redistributes an agent's currently active tickets. It first checks if there is already another assignee.
 * If so, it ensures they are the primary assignee. Otherwise, it lists all the available agents who will
 * meet the ticket deadline and assigns the ticket to the least-loaded one.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param departing_agent_id The ID of the agent whose tickets are being reassigned.
 * @param reassigned_by The ID of the agent performing the reassignment.
 * @returns An object containing arrays of reassigned and unassigned tickets.
 * @throws if the reassigning agent does not have permission to access everything on the helpdesk.
 */
export async function reassignAgentTickets(
    fdm: FdmHelpdeskType,
    departing_agent_id: string,
    reassigned_by: string,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            reassigned_by,
            "reassignAgentTickets",
        )
        const ticketsToReassign = await getTickets(
            fdm,
            reassigned_by,
            {
                assignees: [departing_agent_id],
                statuses: ACTIVE_TICKET_STATUSES,
            },
            "priority",
        )
        const reassigned: TicketReassignment[] = []
        const unassigned: string[] = []
        for (const ticket of ticketsToReassign) {
            // No need to reassign if there is already another primary assignee
            const otherAssignee = ticket.assignees.find(
                (a) => a.agent_id !== departing_agent_id,
            )
            if (otherAssignee) {
                if (!otherAssignee.is_primary) {
                    await assignTicketUnchecked(
                        fdm,
                        ticket.ticket_id,
                        otherAssignee.agent_id,
                        reassigned_by,
                        true,
                    )
                }
            }

            const result = await autoAssignTicket(
                fdm,
                ticket.ticket_id,
                new Date(),
            )
            if (result.assigned) {
                reassigned.push({
                    ticket: ticket,
                    agent_id: result.agent_id,
                    display_name:
                        ticket.assignees.find(
                            (a) => a.agent_id === result.agent_id,
                        )?.display_name ?? "",
                    is_primary: true,
                })
            } else {
                unassigned.push(ticket.ticket_id)
            }
        }
        return { reassigned, unassigned }
    } catch (err) {
        throw handleError(err, "Exception for reassignAgentTickets", {
            departing_agent_id,
            reassigned_by,
        })
    }
}

/**
 * Sets the agent status.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param agent_id ID of the agent whose status is being set.
 * @param status The new status of the agent.
 */
export async function setAgentStatus(
    fdm: FdmHelpdeskType,
    principal_id: string,
    agent_id: string,
    status: string,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            principal_id,
            "setAgentStatus",
        )

        await fdm
            .update(schema.agents)
            .set({
                availability_status: status,
                updated: sql`now()`,
            })
            .where(eq(schema.agents.agent_id, agent_id))
    } catch (err) {
        throw handleError(err, "Exception for setAgentStatus", {
            agent_id,
            status,
        })
    }
}

/**
 * Sets the days of the week that the agent is available to handle tickets.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param agent_id ID of the agent whose work days are being set.
 * @param work_days An array of numbers representing the days of the week the agent is available (0 = Sunday, 6 = Saturday).
 * @throws if any of the provided work days are invalid (not in the range 0-6).
 */
export async function setWorkDays(
    fdm: FdmHelpdeskType,
    principal_id: string,
    agent_id: string,
    work_days: number[],
) {
    try {
        for (const day of work_days) {
            if (day < 0 || day > 6) {
                throw new Error(`Invalid work day: ${day}`)
            }
        }
        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            principal_id,
            "setWorkDays",
        )

        await fdm
            .update(schema.agents)
            .set({
                work_days: [...new Set(work_days)].sort((a, b) => a - b),
                updated: sql`now()`,
            })
            .where(eq(schema.agents.agent_id, agent_id))
    } catch (err) {
        throw handleError(err, "Exception for setWorkDays", {
            agent_id,
            work_days,
        })
    }
}

/**
 * Sets the assignment tier for the agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param agent_id ID of the agent whose assignment tier is being set.
 * @param assignment_tier The assignment tier to set for the agent (1, 2, or 3).
 * @throws if the provided assignment tier is invalid (not 1, 2, or 3).
 */
export async function setAssignmentTier(
    fdm: FdmHelpdeskType,
    principal_id: string,
    agent_id: string,
    assignment_tier: 1 | 2 | 3,
) {
    try {
        if (![1, 2, 3].includes(assignment_tier)) {
            throw new Error(`Invalid assignment tier: ${assignment_tier}`)
        }

        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            principal_id,
            "setAssignmentTier",
        )

        await fdm
            .update(schema.agents)
            .set({
                assignment_tier: assignment_tier,
                updated: sql`now()`,
            })
            .where(eq(schema.agents.agent_id, agent_id))
    } catch (err) {
        throw handleError(err, "Exception for setAssignmentTier", {
            agent_id,
            assignment_tier,
        })
    }
}

export async function setMaxTickets(
    fdm: FdmHelpdeskType,
    principal_id: string,
    agent_id: string,
    max_tickets?: number | null | undefined,
) {
    try {
        if (
            max_tickets !== undefined &&
            max_tickets !== null &&
            max_tickets < 0
        ) {
            throw new Error(`Invalid max tickets: ${max_tickets}`)
        }

        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            principal_id,
            "setMaxTickets",
        )

        if (max_tickets !== undefined) {
            await fdm
                .update(schema.agents)
                .set({
                    max_tickets: max_tickets,
                    updated: sql`now()`,
                })
                .where(eq(schema.agents.agent_id, agent_id))
        }
    } catch (err) {
        throw handleError(err, "Exception for setMaxTickets", {
            agent_id,
            max_tickets,
        })
    }
}

/**
 * Records the absence of an agent between two specific dates, along with a reason and an optional note.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param agent_id ID of the agent to record the absence of.
 * @param start_date The start date of the absence.
 * @param end_date The end date of the absence.
 * @param reason The reason for the absence.
 * @param note An optional note providing additional details about the absence.
 */
export async function scheduleAbsence(
    fdm: FdmHelpdeskType,
    principal_id: string,
    agent_id: string,
    start_date: Date,
    end_date: Date,
    reason: string,
    note?: string,
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            agent_id,
            principal_id,
            "scheduleAbsence",
        )

        const absence_id = createId()
        await fdm.insert(schema.agentAbsences).values({
            absence_id: absence_id,
            agent_id: agent_id,
            start_date: start_date,
            end_date: end_date,
            reason: reason,
            note: note,
        })
    } catch (err) {
        throw handleError(err, "Exception for scheduleAbsence", {
            agent_id,
            start_date: start_date.toISOString(),
            end_date: end_date.toISOString(),
        })
    }
}

export async function cancelAbsence(
    fdm: FdmHelpdeskType,
    availability_id: string,
) {
    try {
        const absence = await getAbsence(fdm, availability_id)

        await checkHelpdeskPermission(
            fdm,
            "agent",
            "write",
            absence.agent_id,
            "",
            "cancelAbsence",
        )

        await fdm
            .delete(schema.agentAbsences)
            .where(eq(schema.agentAbsences.absence_id, availability_id))
    } catch (err) {
        throw handleError(err, "Exception for cancelAbsence", {
            availability_id,
        })
    }
}

export async function getAbsence(fdm: FdmHelpdeskType, absence_id: string) {
    try {
        const absences = await fdm
            .select()
            .from(schema.agentAbsences)
            .where(eq(schema.agentAbsences.absence_id, absence_id))
            .limit(1)

        if (absences.length === 0) {
            throw new Error(`Absence with ID ${absence_id} not found`)
        }

        await checkHelpdeskPermission(
            fdm,
            "agent",
            "read",
            absences[0].agent_id,
            "",
            "getAbsence",
        )

        return absences[0]
    } catch (err) {
        throw handleError(err, "Exception for getAbsence", {
            absence_id,
        })
    }
}

export async function getAgentAbsences(fdm: FdmHelpdeskType, agent_id: string) {
    return fdm
        .select()
        .from(schema.agentAbsences)
        .where(eq(schema.agentAbsences.agent_id, agent_id))
        .orderBy((t) => [asc(t.start_date)])
}
