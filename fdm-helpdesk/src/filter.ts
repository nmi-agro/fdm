import {
    and,
    eq,
    exists,
    gte,
    ilike,
    inArray,
    isNotNull,
    isNull,
    lte,
    notExists,
    or,
    type SQL,
    sql,
} from "drizzle-orm"
import * as schema from "./db/schema-helpdesk"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import type {
    AgentFilters,
    MessageFilters,
    TicketFilters,
} from "./filter.types"

/**
 * Gets the WHERE clause to filter a database agent selection
 *
 * The query needs to start by selecting "fdm-helpdesk"."agents"
 *
 * @param filters filters to apply
 * @returns a drizzle-orm SQL object
 */
export function getAgentWhereClause(filters: AgentFilters) {
    return and(
        // To not have an empty case
        sql`TRUE`,
        // Activity filter - availability is separate
        typeof filters.isActive === "boolean"
            ? eq(schema.agents.is_active, filters.isActive)
            : undefined,
        // Text filter
        typeof filters.text === "string" && filters.text.length > 0
            ? ilike(schema.agents.display_name, `%${filters.text}%`)
            : undefined,
    )
}

/**
 * Gets the WHERE clause to filter a database message selection. This by itself will get the messages for all
 * tickets, therefore it should be used in conjunction with a ticket_id condition.
 *
 * The query needs to start by selecting "fdm-helpdesk"."messages"
 *
 * @param filters filters to apply
 * @returns a drizzle-orm SQL object
 */
export function getMessageWhereClause(filters: MessageFilters) {
    return and(
        sql`TRUE`,
        typeof filters.isInternal === "boolean"
            ? eq(schema.messages.is_internal, filters.isInternal)
            : undefined,
        !filters?.includeDeleted
            ? isNull(schema.messages.deleted_at)
            : undefined,
        filters?.fromDate
            ? gte(schema.messages.created, filters.fromDate)
            : undefined,
        filters?.toDate
            ? lte(schema.messages.created, filters.toDate)
            : undefined,
        Array.isArray(filters?.sentBy) && filters.sentBy.length > 0
            ? inArray(schema.messages.sender_id, filters.sentBy)
            : undefined,
    )
}

/**
 * Gets the WHERE clause to filter a database ticket selection
 *
 * The query needs to start by joining "fdm-helpdesk"."tickets" with "fdm-helpdesk"."ticket_assignments" and
 * "fdm-helpdesk"."ticket_tags_map"
 *
 * @param filters filters to apply
 * @returns a drizzle-orm SQL object
 */
export function getTicketWhereClause(
    fdm: FdmHelpdeskType,
    filters: TicketFilters,
): SQL<unknown> | undefined {
    // Build the priority filter if the user has specified either min priority or max priority out of the known priority options
    let priorityFilter: SQL | undefined
    if (filters.minPriority || filters.maxPriority) {
        const priorities = ["low", "normal", "high", "urgent"] as const
        const minPriorityIndex = filters?.minPriority
            ? priorities.indexOf(filters.minPriority)
            : -1
        const maxPriorityIndex = filters?.maxPriority
            ? priorities.indexOf(filters.maxPriority)
            : -1
        if (minPriorityIndex !== -1 || maxPriorityIndex !== -1) {
            priorityFilter = inArray(
                schema.tickets.priority,
                priorities.slice(
                    minPriorityIndex !== -1 ? minPriorityIndex : 0,
                    maxPriorityIndex !== -1
                        ? maxPriorityIndex + 1
                        : priorities.length,
                ),
            )
        }
    }

    return and(
        // To not have an empty case
        sql`TRUE`,
        // Requester IDs
        Array.isArray(filters.requesterIds) && filters.requesterIds.length > 0
            ? and(
                  isNotNull(schema.tickets.requester_id),
                  inArray(schema.tickets.requester_id, filters.requesterIds),
              )
            : undefined,
        // Farm ID
        typeof filters.context?.b_id_farm === "string"
            ? eq(schema.tickets.context_farm_id, filters.context.b_id_farm)
            : undefined,
        // Priority
        priorityFilter,
        // Status
        Array.isArray(filters.statuses) && filters.statuses.length > 0
            ? inArray(schema.tickets.status, filters.statuses)
            : undefined,
        // Assigned
        filters?.assigned === true
            ? exists(
                  fdm
                      .select({ ticket_id: schema.ticketAssignments.ticket_id })
                      .from(schema.ticketAssignments)
                      .where(
                          and(
                              eq(
                                  schema.ticketAssignments.ticket_id,
                                  schema.tickets.ticket_id,
                              ),
                              isNull(schema.ticketAssignments.unassigned_at),
                          ),
                      ),
              )
            : undefined,
        filters?.assigned === false
            ? notExists(
                  fdm
                      .select({ ticket_id: schema.ticketAssignments.ticket_id })
                      .from(schema.ticketAssignments)
                      .where(
                          and(
                              eq(
                                  schema.ticketAssignments.ticket_id,
                                  schema.tickets.ticket_id,
                              ),
                              isNull(schema.ticketAssignments.unassigned_at),
                          ),
                      ),
              )
            : undefined,
        // Assignees
        Array.isArray(filters?.assignees) && filters.assignees.length > 0
            ? and(
                  isNotNull(schema.ticketAssignments.agent_id),
                  isNull(schema.ticketAssignments.unassigned_at),
                  inArray(schema.ticketAssignments.agent_id, filters.assignees),
              )
            : undefined,
        // Tags filter
        Array.isArray(filters?.tags) && filters.tags.length > 0
            ? inArray(schema.ticketTagsMap.tag_id, filters.tags)
            : undefined,
        // Text filter
        filters.text
            ? or(
                  sql`to_tsvector('dutch', ${schema.tickets.ticket_ref} || ' ' || coalesce(${schema.tickets.subject}, '')) @@ websearch_to_tsquery('dutch', ${filters.text})`,
                  sql`to_tsvector('dutch', ${schema.messages.body}) @@ websearch_to_tsquery('dutch', ${filters.text})`,
              )
            : undefined,
        // Timeframe filter
        filters?.fromDate
            ? gte(schema.tickets.created, filters.fromDate)
            : undefined,
        filters?.toDate
            ? lte(schema.tickets.created, filters.toDate)
            : undefined,
        // Viewed filter
        Array.isArray(filters.viewedBy) && filters.viewedBy.length > 0
            ? inArray(schema.ticketViews.actor_id, filters.viewedBy)
            : undefined,
        Array.isArray(filters.notViewedBy) && filters.notViewedBy.length > 0
            ? notExists(
                  fdm
                      .select()
                      .from(schema.ticketViews)
                      .where(
                          and(
                              eq(
                                  schema.ticketViews.ticket_id,
                                  schema.tickets.ticket_id,
                              ),
                              inArray(
                                  schema.ticketViews.actor_id,
                                  filters.notViewedBy,
                              ),
                          ),
                      ),
              )
            : undefined,
    )
}
