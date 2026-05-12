import type { FdmType, PrincipalId } from "@nmi-agro/fdm-core"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"

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

export async function getAssigneesForTickets(
    fdm: FdmType,
    agent_id: PrincipalId,
    ticket_ids: string[],
): Promise<
    Map<schema.TicketTypeSelect["ticket_id"], TicketAssignmentSummary[]>
> {
    await Promise.all(
        ticket_ids.map((ticket_id) =>
            checkHelpdeskPermission(
                fdm,
                "ticket-agent-side",
                "read",
                ticket_id,
                agent_id,
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

export async function assignTicket(
    fdm: FdmType,
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
                .set({ is_primary: false })
                .where(eq(schema.ticketAssignments.ticket_id, ticket_id))
        }

        // Insert the new assignment
        await tx
            .insert(schema.ticketAssignments)
            .values([
                {
                    ticket_id: ticket_id,
                    agent_id: agent_id,
                    assigned_by: assigned_by,
                },
            ])
            .onConflictDoUpdate({
                target: [
                    schema.ticketAssignments.ticket_id,
                    schema.ticketAssignments.agent_id,
                ],
                set: {
                    is_primary: is_primary,
                },
            })
    })
}
