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
import { ACTIVE_TICKET_STATUSES, getTickets } from "./ticket"
import {
    assignTicketUnchecked,
    type TicketAssignmentSummary,
} from "./ticket-assignment"

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
        return fdm
            .select({
                ...agentSummaryColumns,
                // Total "weight" of all active tickets that this agent is assigned to
                total_assigned_weight: sql`WITH priority_weights (priority, weight) AS (
   SELECT priority, weight AS total_sales
   FROM (values ('low', 1), ('normal', 2), ('high', 4), ('urgent', 8)) as priority_weights (priority, weight)
) select sum(coalesce(weight, 3))
    from ${schema.ticketAssignments}
	join ${schema.tickets} on ${schema.ticketAssignments.ticket_id} = ${schema.tickets.ticket_id}
	left join priority_weights pw on ${schema.tickets.priority} = pw.priority
	where ${schema.ticketAssignments.agent_id} = ${schema.agents.agent_id}
    and ${inArray(schema.tickets.status, ACTIVE_TICKET_STATUSES)}
`,
                num_assigned_tickets: fdm.$count(
                    schema.ticketAssignments.assignment_id,
                    and(
                        eq(
                            schema.ticketAssignments.agent_id,
                            schema.agents.agent_id,
                        ),
                        inArray(schema.tickets.status, ACTIVE_TICKET_STATUSES),
                    ),
                ),
            })
            .from(schema.agents)
            .where((t) =>
                and(
                    // Is the agent active?
                    eq(schema.agents.is_active, true),
                    // Is the agent online?
                    eq(schema.agents.availability_status, "online"),
                    // Is the agent free on this day of the week?
                    sql`${schema.agents.work_days} @> array[${date.getDay()}]`,
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
 * Auto-assign to least-loaded available agent (respects tier cascade)
 *
 * No permission checks are performed, and assigned_by is set to "SYSTEM". Use with caution.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id Ticket ID to assign.
 * @param date Date on which to check the agent availabilites for.
 * @returns If assignment succeeded, assigned: true and agent_id is the ID of the agent assigned.
 * If no agents were available, assigned: false.
 */
async function autoAssignTicket(
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
        throw handleLoaderError(err, "Exception for autoAssignTicket", {
            ticket_id,
            date: date.toISOString(),
        })
    }
}

// Redistribute an agent's open tickets
async function reassignAgentTickets(
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
        const reassigned: (TicketAssignmentSummary & { ticket_id: string })[] =
            []
        const unassigned: string[] = []
        for (const ticket of ticketsToReassign) {
            if (
                ticket.assignees.find((a) => a.agent_id !== departing_agent_id)
                    ?.is_primary
            ) {
                continue
            }
            const result = await autoAssignTicket(
                fdm,
                ticket.ticket_id,
                new Date(),
            )
            if (result.assigned) {
                reassigned.push({
                    ticket_id: ticket.ticket_id,
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
        throw handleLoaderError(err, "Exception for reassignAgentTickets", {
            departing_agent_id,
            reassigned_by,
        })
    }
}

// Status & schedule management
async function setAgentStatus(
    fdm: FdmHelpdeskType,
    agent_id: string,
    status: string,
) {}
async function setWorkDays(
    fdm: FdmHelpdeskType,
    agent_id: string,
    work_days: number[],
) {}
async function setAssignmentTier(
    fdm: FdmHelpdeskType,
    agent_id: string,
    tier: 1 | 2 | 3,
) {}
async function scheduleAbsence(
    fdm: FdmHelpdeskType,
    agent_id: string,
    start_date: Date,
    end_date: Date,
    reason: string,
    note?: string,
) {}
async function cancelAbsence(fdm: FdmHelpdeskType, availability_id: string) {}
async function getAgentAbsences(fdm: FdmHelpdeskType, agent_id: string) {}
function handleLoaderError(
    err: unknown,
    arg1: string,
    arg2: { ticket_id: string; date: string },
) {
    throw new Error("Function not implemented.")
}
