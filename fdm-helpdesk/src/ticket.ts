import { desc, eq, inArray, sql } from "drizzle-orm"
import { customAlphabet } from "nanoid"
import { checkHelpdeskPermission, getHelpdeskPermission } from "./authorization"
import type { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { getTicketWhereClause } from "./filter"
import type { TicketFilters } from "./filter.types"
import { createId } from "./id"
import { escapeHTML } from "./sanitization"
import { getTagsForTickets, type TagSummary } from "./tag"
import {
    getAssigneesForTickets,
    type TicketAssignmentSummary,
} from "./ticket-assignment"

/** A ticket record enriched with its current tags and assignees. */
export type Ticket = schema.TicketTypeSelect & {
    tags: TagSummary[]
    assignees: TicketAssignmentSummary[]
}

const TICKET_ALPHABET = "23456789ABCDFGHJKLMNPQRSTVWXYZ" // Uppercase, no lookalikes
const ticketAlphabet = customAlphabet(TICKET_ALPHABET, 6)
const generateTicketRef = () => `TK-${ticketAlphabet()}` // ~530 million combinations
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

/**
 * Retrieves a single ticket by ID, including its tags and current assignees.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read access to the ticket.
 * @param ticket_id ID of the ticket to retrieve.
 * @returns The ticket record with tags and assignees.
 */
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

/**
 * Returns the agent's personal inbox: the subset of tickets that are assigned to the given agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param agent_id The agent whose inbox to load.
 * @param filters Optional filters to narrow the results further.
 * @returns An array of tickets assigned to the agent that match the filters.
 */
export async function getInbox(
    fdm: FdmHelpdeskType,
    agent_id: HelpdeskPrincipalId,
    filters: TicketFilters = {},
) {
    const agent_ids = Array.isArray(agent_id) ? agent_id : [agent_id]
    return await getTickets(fdm, agent_id, {
        ...filters,
        assignees: [...(filters.assignees ?? []), ...agent_ids],
    })
}

/**
 * Returns all tickets visible to the principal, enriched with tags and assignees.
 * Non-helpdesk principals (regular users) can only see tickets they requested.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 * @param filters Optional filters for status, priority, requester, tags, assignees, and pagination.
 * @returns An array of tickets matching the filters.
 */
export async function getTickets(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    filters: TicketFilters = {},
): Promise<Ticket[]> {
    try {
        const tickets = (await selectTickets(
            fdm,
            principal_id,
            false,
            filters,
        )) as Omit<Ticket, "assignees" | "tags">[]

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

/**
 * Returns the total count of tickets visible to the principal after applying filters.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 * @param filters Optional filters to apply before counting.
 * @returns The number of matching tickets.
 */
export async function getTicketCount(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    filters: TicketFilters = {},
): Promise<number> {
    try {
        return (
            (await selectTickets(fdm, principal_id, true, filters))[0] as {
                count: number
            }
        ).count
    } catch (err) {
        throw handleError(err, "Exception for getTicketCount", {
            principal_id,
            filters,
        })
    }
}

async function selectTickets(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    selectCount: boolean,
    filters: TicketFilters = {},
) {
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

    const whereClause = getTicketWhereClause({ ...filters, requesterIds })

    if (selectCount) {
        return await fdm
            .select({
                count: sql<number>`cast(count(distinct ${schema.tickets.ticket_id}) as integer)`,
            })
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
                schema.ticketViews,
                inArray(schema.ticketViews.actor_id, principal_ids),
            )
            .where(whereClause)
    }

    let query = fdm
        .selectDistinct(ticketColumns)
        .from(schema.tickets)
        .leftJoin(
            schema.ticketAssignments,
            eq(schema.ticketAssignments.ticket_id, schema.tickets.ticket_id),
        )
        .leftJoin(
            schema.ticketTagsMap,
            eq(schema.ticketTagsMap.ticket_id, schema.tickets.ticket_id),
        )
        // TODO: check if each agent has viewed, not only one of them
        .leftJoin(
            schema.ticketViews,
            inArray(schema.ticketViews.actor_id, principal_ids),
        )
        .where(whereClause)
        .groupBy(schema.tickets.ticket_id)
        .orderBy(desc(schema.tickets.priority), desc(schema.tickets.created))

    if (filters.pageOffset) {
        query = query.offset(filters.pageOffset) as typeof query
    }

    if (filters.pageLimit) {
        query = query.limit(filters.pageLimit) as typeof query
    }

    return await query
}

type CreateTicketOptions = {
    priority?: string
    context?: { b_id_farm?: string | null }
}

/**
 * Build subject from first few words, not exceeding MAX_SUBJECT_LENGTH characters.
 * The return value which is added initially to the ticket will later be replaced by an AI agent with a one
 * sentence summary of the ticket.
 *
 * @param body body text to "summarize"
 * @returns the subject line
 */
export function getDefaultSubjectLine(body: string) {
    const MIN_SUBJECT_LENGTH = 20
    const MAX_SUBJECT_LENGTH = 100
    let subject = ""
    let bodyCurrentIndex = 0
    const SPACES = " \n\r\t".split("")
    while (true) {
        const bodyNextIndex = Math.min(
            body.length,
            ...SPACES.map((s) => body.indexOf(s, bodyCurrentIndex)).filter(
                (x) => x !== -1,
            ),
        )
        if (bodyNextIndex === -1) {
            const word = ` ${body.slice(bodyCurrentIndex)}`
            if (subject.length + word.length <= MAX_SUBJECT_LENGTH + 1) {
                subject += word
            } else if (subject.length < MIN_SUBJECT_LENGTH) {
                subject += word.slice(
                    0,
                    MIN_SUBJECT_LENGTH - subject.length + 1,
                )
            }
            break
        }
        const word = ` ${body.slice(bodyCurrentIndex, bodyNextIndex)}`
        if (subject.length + word.length <= MAX_SUBJECT_LENGTH + 1) {
            subject += word
        } else {
            if (subject.length < MIN_SUBJECT_LENGTH) {
                subject += word.slice(
                    0,
                    MIN_SUBJECT_LENGTH - subject.length + 1,
                )
            }
            break
        }
        bodyCurrentIndex = bodyNextIndex + 1
        while (
            bodyCurrentIndex < body.length &&
            SPACES.includes(body[bodyCurrentIndex])
        ) {
            bodyCurrentIndex++
        }
    }

    return subject.trim()
}

/**
 * Creates a new ticket and its first message in a single transaction.
 * The body is HTML-escaped and a subject line is derived from the first few words.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param requester_id ID of the user who is opening the ticket.
 * @param body The opening message body.
 * @param options Optional priority and farm context to associate with the ticket.
 * @returns The `ticket_id` of the newly created ticket.
 */
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
            const sanitizedBody = escapeHTML(body)

            await tx.insert(schema.tickets).values([
                {
                    ticket_id: ticket_id,
                    ticket_ref: ticket_ref,
                    requester_id: requester_id,
                    subject: getDefaultSubjectLine(sanitizedBody),
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
                body: sanitizedBody,
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

/**
 * Checks whether a ticket status transition is allowed.
 * Returns `true` when moving from `from` to `to` is a permitted transition.
 *
 * @param from Current ticket status.
 * @param to Desired next ticket status.
 * @returns `true` if the transition is allowed, `false` otherwise.
 */
export function validateTicketStatusTransition(
    from: string,
    to: string,
): boolean {
    return ALLOWED_TICKET_STATUS_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Updates the status of a ticket after validating the transition is allowed.
 * Sets `resolved_at` or `closed_at` timestamps automatically when entering those states.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have agent-side write access to the ticket.
 * @param ticket_id ID of the ticket to update.
 * @param status The new status to transition to.
 */
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
                status: status,
                updated: sql`now()`,
                resolved_at: status === "resolved" ? sql`now()` : undefined,
                closed_at: status === "closed" ? sql`now()` : undefined,
            })
            .where(eq(schema.tickets.ticket_id, ticket_id))
    } catch (err) {
        throw handleError(err, "Exception for updateTicketStatus")
    }
}
