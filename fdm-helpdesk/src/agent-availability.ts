import { and, asc, eq, gte, inArray, isNull, lt, lte, notExists, or, sql } from "drizzle-orm"
import type { AgentSummary } from "./agent"
import type { HelpdeskPrincipalId } from "./authorization.types"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { createId } from "./id"
import { ACTIVE_TICKET_STATUSES, getTickets, type Ticket } from "./ticket"
import { assignTicketUnchecked, type TicketAssignmentSummary } from "./ticket-assignment"

export type AgentAbsence = schema.AgentAbsenceTypeSelect

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

const agentAbsenceColumns = {
  absence_id: schema.agentAbsences.absence_id,
  agent_id: schema.agentAbsences.agent_id,
  start_date: schema.agentAbsences.start_date,
  end_date: schema.agentAbsences.end_date,
  reason: schema.agentAbsences.reason,
  note: schema.agentAbsences.note,
  created: schema.agentAbsences.created,
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
        total_assigned_weight: sql`(select sum(CASE t.priority
        WHEN 'low' THEN 1
        WHEN 'normal' THEN 2
        WHEN 'high' THEN 4
        WHEN 'urgent' THEN 8
        ELSE 3
    END) FROM ${schema.ticketAssignments} ta
    JOIN ${schema.tickets} t
      ON ta.ticket_id = t.ticket_id
    WHERE
        ta.agent_id = ${schema.agents.agent_id}
      AND ${inArray(sql`t.status`, ACTIVE_TICKET_STATUSES)})`,
        // Number of active tickets that this agent is assigned to
        num_assigned_tickets: sql`(select count(*)
from ${schema.ticketAssignments} ta
inner join ${schema.tickets} t on ta.ticket_id = t.ticket_id
where ta.agent_id = ${schema.agents.agent_id}
and ${inArray(sql`t.status`, ACTIVE_TICKET_STATUSES)})`,
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
                  eq(schema.agentAbsences.agent_id, schema.agents.agent_id),
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
export async function autoAssignTicket(fdm: FdmHelpdeskType, ticket_id: string, date: Date) {
  try {
    const availableAgents = await getAvailableAgents(fdm, date)
    if (availableAgents.length > 0) {
      const agentToAssign = availableAgents[0]
      await assignTicketUnchecked(fdm, ticket_id, agentToAssign.agent_id, "SYSTEM", true)
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
      const otherAssignee = ticket.assignees.find((a) => a.agent_id !== departing_agent_id)
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

      const result = await autoAssignTicket(fdm, ticket.ticket_id, new Date())
      if (result.assigned) {
        reassigned.push({
          ticket: ticket,
          agent_id: result.agent_id,
          display_name:
            ticket.assignees.find((a) => a.agent_id === result.agent_id)?.display_name ?? "",
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
    await checkHelpdeskPermission(fdm, "agent", "write", agent_id, principal_id, "setAgentStatus")

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
    await checkHelpdeskPermission(fdm, "agent", "write", agent_id, principal_id, "setWorkDays")

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
    if (max_tickets !== undefined && max_tickets !== null && max_tickets < 0) {
      throw new Error(`Invalid max tickets: ${max_tickets}`)
    }

    await checkHelpdeskPermission(fdm, "agent", "write", agent_id, principal_id, "setMaxTickets")

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
    await checkHelpdeskPermission(fdm, "agent", "write", agent_id, principal_id, "scheduleAbsence")

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

/**
 * Updates the dates, reason, and/or note of an existing absence.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param absence_id ID of the absence to update.
 * @param updates The fields to update. Only the provided fields are changed.
 */
export async function updateAbsence(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  absence_id: string,
  updates: {
    start_date?: Date
    end_date?: Date
    reason?: string
    note?: string | null
  },
) {
  try {
    const absence = await getAbsence(fdm, principal_id, absence_id)

    await checkHelpdeskPermission(
      fdm,
      "agent",
      "write",
      absence.agent_id,
      principal_id,
      "updateAbsence",
    )

    await fdm
      .update(schema.agentAbsences)
      .set({
        start_date: updates.start_date,
        end_date: updates.end_date,
        reason: updates.reason,
        note: updates.note,
      })
      .where(eq(schema.agentAbsences.absence_id, absence_id))
  } catch (err) {
    throw handleError(err, "Exception for updateAbsence", {
      absence_id,
      ...updates,
    })
  }
}

/**
 * Cancels (deletes) an existing absence.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param availability_id ID of the absence to cancel.
 */
export async function cancelAbsence(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  availability_id: string,
) {
  try {
    const absence = await getAbsence(fdm, principal_id, availability_id)

    await checkHelpdeskPermission(
      fdm,
      "agent",
      "write",
      absence.agent_id,
      principal_id,
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

/**
 * Gets a single absence by ID.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @param absence_id ID of the absence to get.
 */
export async function getAbsence(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  absence_id: string,
) {
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
      principal_id,
      "getAbsence",
    )

    return absences[0]
  } catch (err) {
    throw handleError(err, "Exception for getAbsence", {
      absence_id,
    })
  }
}

/**
 * Gets all absences of the agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param agent_id Agent ID to get the absences of
 * @returns Array of absences, ordered by start date
 */
export async function getAgentAbsences(fdm: FdmHelpdeskType, agent_id: string) {
  return fdm
    .select()
    .from(schema.agentAbsences)
    .where(eq(schema.agentAbsences.agent_id, agent_id))
    .orderBy((t) => [asc(t.start_date)])
}

/**
 * Gets each agent's absence that ends the latest on the given day.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param date Date to check for absences on
 * @returns Map of agent IDs to the found absence, for each agent who is absent on the given date
 */
export async function getAbsencesForAgents(fdm: FdmHelpdeskType, date = new Date()) {
  try {
    // select the absence that ends the latest for each agent
    const rankedAbsences = fdm
      .select({
        ...agentAbsenceColumns,
        _rank:
          sql`ROW_NUMBER() OVER (PARTITION BY ${schema.agentAbsences.agent_id} ORDER BY ${schema.agentAbsences.end_date} DESC)`.as(
            "_rank",
          ),
      })
      .from(schema.agentAbsences)
      .where(
        and(lte(schema.agentAbsences.start_date, date), gte(schema.agentAbsences.end_date, date)),
      )
      .as("sq")

    const absences = await fdm.select().from(rankedAbsences).where(eq(rankedAbsences._rank, 1))

    return new Map<string, AgentAbsence>(absences.map((absence) => [absence.agent_id, absence]))
  } catch (err) {
    throw handleError(err, "Exception for getAbsencesForAgents")
  }
}

/**
 * Gets every recorded absence across all agents, joined with the agent's display name.
 *
 * Any agent or admin on the helpdesk may read the full list; this is what powers the shared
 * absence calendar where everyone's absences are visible to every agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); supports a single ID or an array.
 * @throws if the principal does not have permission to read the helpdesk.
 */
export async function getAllAbsences(fdm: FdmHelpdeskType, principal_id: HelpdeskPrincipalId) {
  try {
    await checkHelpdeskPermission(fdm, "helpdesk", "read", "", principal_id, "getAllAbsences")

    return await fdm
      .select({ ...agentAbsenceColumns, display_name: schema.agents.display_name })
      .from(schema.agentAbsences)
      .innerJoin(schema.agents, eq(schema.agentAbsences.agent_id, schema.agents.agent_id))
      .orderBy((t) => [asc(t.start_date)])
  } catch (err) {
    throw handleError(err, "Exception for getAllAbsences", {
      principal_id,
    })
  }
}
