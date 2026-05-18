import {
    and,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    lte,
    type SQL,
    sql,
} from "drizzle-orm"
import { customAlphabet } from "nanoid"
import { checkHelpdeskPermission, getHelpdeskPermission } from "./authorization"
import type { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import type {
    AssigneeFilter,
    PaginationFilter,
    PriorityFilter,
    RequesterFilter,
    TagsFilter,
    TicketContextFilter,
    TimeframeFilter,
} from "./filter"
import { createId } from "./id"
import { getTagsForTickets, type TagSummary } from "./tag"
import {
    getAssigneesForTickets,
    type TicketAssignmentSummary,
} from "./ticket-assignment"

export type Ticket = schema.TicketTypeSelect & {
    tags: TagSummary[]
    assignees: TicketAssignmentSummary[]
}

const TICKET_ALPHABET = "23456789ABCDFGHJKLMNPQRSTVWXYZ" // Uppercase, no lookalikes
const generateTicketRef = customAlphabet(TICKET_ALPHABET, 6) // ~530 million combinations
async function createTicketRefWithRetry(
    fdm: FdmHelpdeskType,
    maxRetries = 3,
): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
        const ref = generateTicketRef()
        const existing = await fdm
            .select()
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_ref, ref))
            .limit(1)
        if (existing.length === 0) return ref
    }
    throw new Error("Failed to generate unique ticket ref after retries")
}

const ticketColumns = {
    ticket_id: schema.tickets.ticket_id,
    ticket_ref: schema.tickets.ticket_ref,
    subject: schema.tickets.subject,
    status: schema.tickets.status,
    priority: schema.tickets.priority,
    channel: schema.tickets.channel,
    requester_id: schema.tickets.requester_id,
    context_farm_id: schema.tickets.context_farm_id,
    resolved_at: schema.tickets.resolved_at,
    closed_at: schema.tickets.closed_at,
    created: schema.tickets.created,
    updated: schema.tickets.updated,
}

export async function getTicket(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
): Promise<Ticket> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "read",
            ticket_id,
            principal_id,
            "getTicket",
        )

        const found = await fdm
            .select(ticketColumns)
            .from(schema.tickets)
            .where(eq(schema.tickets.ticket_id, ticket_id))

        const tags =
            (await getTagsForTickets(fdm, principal_id, [ticket_id])).get(
                ticket_id,
            ) ?? []
        const assignees =
            (await getAssigneesForTickets(fdm, principal_id, [ticket_id])).get(
                ticket_id,
            ) ?? []

        return { ...found[0], tags, assignees }
    } catch (err) {
        throw handleError(err, "Error")
    }
}

type Filters = AssigneeFilter &
    TicketContextFilter &
    PaginationFilter &
    PriorityFilter &
    RequesterFilter &
    TagsFilter &
    TimeframeFilter

export async function getInbox(
    fdm: FdmHelpdeskType,
    agent_id: HelpdeskPrincipalId,
    filters: Filters = {},
) {
    const agent_ids = Array.isArray(agent_id) ? agent_id : [agent_id]
    return await getTickets(fdm, agent_id, {
        ...filters,
        assignees: [...(filters.assignees ?? []), ...agent_ids],
    })
}

export async function getTickets(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    filters: Filters = {},
): Promise<Ticket[]> {
    try {
        const principal_ids = Array.isArray(principal_id)
            ? principal_id
            : [principal_id]

        const helpdeskReadPermission = await getHelpdeskPermission(
            fdm,
            "helpdesk",
            "read",
            "",
            principal_id,
        )

        // Override user filter if they should only be able to see their own tickets
        const requesterIds = !helpdeskReadPermission
            ? principal_ids
            : filters.requesterIds

        // Make sure we limit the number of records that can be returned
        const pageOffset = filters?.pageOffset
            ? Math.max(0, filters.pageOffset)
            : 0
        const pageLimit = filters?.pageLimit
            ? Math.max(1, filters.pageLimit)
            : 20

        // Build the priority filter if the user has specified either min priority or max priority out of the known priority options
        let priorityFilter: SQL | undefined
        if (filters.minPriority || filters.maxPriority) {
            const priorities = ["low", "normal", "high", "urgent"] as const
            const minPriorityIndex = filters.minPriority
                ? priorities.indexOf(filters.minPriority)
                : -1
            const maxPriorityIndex = filters.maxPriority
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

        const tickets = await fdm
            .selectDistinct(ticketColumns)
            .from(schema.tickets)
            .leftJoin(
                schema.ticketAssignments,
                eq(
                    schema.ticketAssignments.ticket_id,
                    schema.tickets.ticket_id,
                ),
            )
            .leftJoin(
                schema.ticketTagsMap,
                eq(schema.ticketTagsMap.ticket_id, schema.tickets.ticket_id),
            )
            .leftJoin(
                schema.tags,
                eq(schema.ticketTagsMap.tag_id, schema.tags.tag_id),
            )
            // TODO: check if each agent has viewed, not only one of them
            .leftJoin(
                schema.ticketViews,
                inArray(schema.ticketViews.actor_id, principal_ids),
            )
            .where(
                and(
                    // To not have an empty case
                    sql`TRUE`,
                    // Requester IDs
                    Array.isArray(requesterIds)
                        ? and(
                              isNotNull(schema.tickets.requester_id),
                              inArray(
                                  schema.tickets.requester_id,
                                  requesterIds,
                              ),
                          )
                        : undefined,
                    // Farm ID
                    typeof filters.context?.b_id_farm === "string"
                        ? eq(
                              schema.tickets.context_farm_id,
                              filters.context.b_id_farm,
                          )
                        : undefined,
                    // Priority
                    priorityFilter,
                    // Assignees
                    Array.isArray(filters?.assignees)
                        ? and(
                              isNotNull(schema.ticketAssignments.agent_id),
                              inArray(
                                  schema.ticketAssignments.agent_id,
                                  filters.assignees,
                              ),
                          )
                        : undefined,
                    // Tags filter
                    Array.isArray(filters?.tags)
                        ? inArray(schema.tags.name, filters.tags)
                        : undefined,
                    // Timeframe filter
                    filters?.fromDate
                        ? gte(schema.tickets.created, filters.fromDate)
                        : undefined,
                    filters?.toDate
                        ? lte(schema.tickets.created, filters.toDate)
                        : undefined,
                ),
            )
            .groupBy(schema.tickets.ticket_id)
            .orderBy(
                desc(schema.tickets.priority),
                desc(schema.tickets.created),
            )
            .offset(pageOffset)
            .limit(pageLimit)

        const ticket_ids = tickets.map((ticket) => ticket.ticket_id)

        const tagsByTicket = await getTagsForTickets(
            fdm,
            principal_id,
            ticket_ids,
        )
        const assigneesByTicket = await getAssigneesForTickets(
            fdm,
            principal_id,
            ticket_ids,
        )

        return tickets.map((ticket) => ({
            ...ticket,
            tags: tagsByTicket.get(ticket.ticket_id) ?? [],
            assignees: assigneesByTicket.get(ticket.ticket_id) ?? [],
        }))
    } catch (err) {
        throw handleError(err, "Exception for getTickets", {
            principal_id,
            filters,
        })
    }
}

type CreateTicketOptions = {
    priority?: string
    context?: { b_id_farm?: string }
}

export async function createTicket(
    fdm: FdmHelpdeskType,
    requester_id: schema.MessageTypeInsert["sender_id"],
    body: schema.MessageTypeInsert["body"],
    options?: CreateTicketOptions,
): Promise<schema.TicketTypeSelect["ticket_id"]> {
    try {
        const ticket_id = createId()
        const message_id = createId()

        return await fdm.transaction(async (tx) => {
            const ticket_ref = await createTicketRefWithRetry(tx)

            await tx.insert(schema.tickets).values([
                {
                    ticket_id: ticket_id,
                    ticket_ref: ticket_ref,
                    requester_id: requester_id,
                    channel: "web",
                    priority: options?.priority,
                    context_farm_id: options?.context?.b_id_farm,
                },
            ])

            await tx.insert(schema.messages).values({
                ticket_id: ticket_id,
                sender_id: requester_id,
                message_id: message_id,
                sender_type: "user",
                body: body,
            })

            return ticket_id
        })
    } catch (e) {
        throw handleError(e, "Exception for createTicket", {
            ...options,
            requester_id,
        })
    }
}

const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<string, string[]> = {
    open: [
        "in_progress",
        "pending",
        "waiting_on_customer",
        "resolved",
        "closed",
    ],
    in_progress: ["pending", "waiting_on_customer", "resolved", "closed"],
    pending: ["in_progress", "waiting_on_customer", "resolved", "closed"],
    waiting_on_customer: ["in_progress", "resolved", "closed"],
    resolved: ["closed", "open"], // "open" = reopen
    closed: ["open"], // "open" = reopen
}

export function validateTicketStatusTransition(
    from: string,
    to: string,
): boolean {
    return ALLOWED_TICKET_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

export async function updateTicketStatus(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
    status: schema.TicketTypeSelect["status"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            principal_id,
            "updateTicketStatus",
        )

        const ticket = await getTicket(fdm, principal_id, ticket_id)

        if (!validateTicketStatusTransition(ticket.status, status)) {
            throw new Error(
                `Invalid status transition: ${ticket.status} → ${status}`,
            )
        }

        await fdm
            .update(schema.tickets)
            .set({
                resolved_at: status === "resolved" ? sql`now()` : undefined,
                status: status,
                updated: sql`now()`,
            })
            .where(eq(schema.tickets.ticket_id, ticket_id))
    } catch (err) {
        throw handleError(err, "Exception for updateTicketStatus")
    }
}
