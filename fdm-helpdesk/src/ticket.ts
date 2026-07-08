import { and, desc, eq, exists, inArray, isNull, max, not, type SQL, sql } from "drizzle-orm"
import { customAlphabet } from "nanoid"
import type { HelpdeskPrincipalId } from "./authorization.types"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import type { TicketFilters, TicketSorting } from "./filter.types"
import { checkHelpdeskPermission, getHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { getTicketWhereClause } from "./filter"
import { createId } from "./id"
import { escapeHTML } from "./sanitization"
import { getTagsForTickets, type TagSummary } from "./tag"
import { getAssigneesForTickets, type TicketAssignmentSummary } from "./ticket-assignment"

/** A ticket record enriched with its current tags and assignees. */
export type Ticket = schema.TicketTypeSelect & {
  viewed_at: Date | null
  tags: TagSummary[]
  assignees: TicketAssignmentSummary[]
}

const TICKET_ALPHABET = "23456789ABCDFGHJKLMNPQRSTVWXYZ" // Uppercase, no lookalikes
const ticketAlphabet = customAlphabet(TICKET_ALPHABET, 6)

/**
 * Creates a ticket reference in the form "TK-ABC123", intended for easily referencing to a ticket.
 * @returns A ticket reference.
 */
const generateTicketRef = () => `TK-${ticketAlphabet()}` // ~530 million combinations

/**
 * Creates a ticket reference in the form "TK-ABC123" and retries until finding a unique reference.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param maxRetries Max retries to fail afterwards. `3` by default.
 * @returns A ticket reference that is unique among all helpdesk tickets.
 * @throws if a unique ticket reference cannot be obtained after `maxRetries`.
 */
async function createTicketRefWithRetry(fdm: FdmHelpdeskType, maxRetries = 3): Promise<string> {
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
  requester_email: schema.tickets.requester_email,
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

    const principal_ids = Array.isArray(principal_id) ? principal_id : [principal_id]

    const found = await fdm
      .select({
        ...ticketColumns,
        viewed_at: schema.ticketViews.viewed_at,
      })
      .from(schema.tickets)
      .leftJoin(
        schema.ticketViews,
        and(
          eq(schema.ticketViews.ticket_id, schema.tickets.ticket_id),
          inArray(schema.ticketViews.actor_id, principal_ids),
        ),
      )
      .where(eq(schema.tickets.ticket_id, ticket_id))
      .limit(1)

    const tags = (await getTagsForTickets(fdm, principal_id, [ticket_id])).get(ticket_id) ?? []
    const assignees =
      (await getAssigneesForTickets(fdm, principal_id, [ticket_id])).get(ticket_id) ?? []

    return { ...found[0], tags, assignees }
  } catch (err) {
    throw handleError(err, "Exception for getTicket", {
      ticket_id,
      principal_id,
    })
  }
}

/**
 * Retrieves a single ticket by ID. Returns null if no ticket is found. No permission checks are performed.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket to retrieve.
 * @returns The ticket record. Null if not found.
 */
export async function tryToGetTicketUnchecked(
  fdm: FdmHelpdeskType,
  ticket_id: schema.TicketTypeSelect["ticket_id"],
): Promise<schema.TicketTypeSelect | null> {
  try {
    const found = await fdm
      .select({
        ...ticketColumns,
      })
      .from(schema.tickets)
      .where(eq(schema.tickets.ticket_id, ticket_id))
      .limit(1)

    return found.length > 0 ? found[0] : null
  } catch (err) {
    throw handleError(err, "Exception for tryToGetTicketUnchecked", {
      ticket_id,
    })
  }
}

/**
 * Retrieves a single ticket with the given reference. If no such ticket is found, returns null.
 *
 * This function does not perform any permission checks.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_ref Ticket ref to look for.
 * @returns A Ticket object without the tags and assignees filled in. null if no ticket was found.
 */
export async function tryToGetTicketByRefUnchecked(
  fdm: FdmHelpdeskType,
  ticket_ref: string,
): Promise<schema.TicketTypeSelect | null> {
  try {
    const found = await fdm
      .select({
        ...ticketColumns,
      })
      .from(schema.tickets)
      .where(eq(schema.tickets.ticket_ref, ticket_ref))
      .limit(1)

    return found.length > 0 ? found[0] : null
  } catch (err) {
    throw handleError(err, "Exception for tryToGetTicketByRefUnchecked", { ticket_ref })
  }
}

/**
 * Returns the agent's personal inbox: the subset of tickets that are assigned to the given agent.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param agent_id The agent whose inbox to load.
 * @param filters Optional filters to narrow the results further.
 * @param sorting Sorting strategy to use.
 * @returns An array of tickets assigned to the agent that match the filters.
 */
export async function getInbox(
  fdm: FdmHelpdeskType,
  agent_id: HelpdeskPrincipalId,
  filters: TicketFilters = {},
  sorting?: TicketSorting,
) {
  const agent_ids = Array.isArray(agent_id) ? agent_id : [agent_id]
  return await getTickets(
    fdm,
    agent_id,
    {
      ...filters,
      assignees: [...(filters.assignees ?? []), ...agent_ids],
    },
    sorting,
  )
}

/**
 * Returns all tickets visible to the principal, enriched with tags and assignees.
 * Non-helpdesk principals (regular users) can only see tickets they requested.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 * @param filters Optional filters for status, priority, requester, tags, assignees, text search, and
 * pagination.
 * @param sorting Sorting strategy to use.
 * @returns An array of tickets matching the filters.
 */
export async function getTickets(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  filters: TicketFilters = {},
  sorting?: TicketSorting,
): Promise<Ticket[]> {
  try {
    const tickets = (await selectTickets(fdm, principal_id, false, filters, sorting)) as Omit<
      Ticket,
      "assignees" | "tags"
    >[]

    const ticket_ids = tickets.map((ticket) => ticket.ticket_id)

    const tagsByTicket = await getTagsForTickets(fdm, principal_id, ticket_ids)
    const assigneesByTicket = await getAssigneesForTickets(fdm, principal_id, ticket_ids)

    return tickets.map((ticket) => {
      return {
        ...ticket,
        tags: tagsByTicket.get(ticket.ticket_id) ?? [],
        assignees: assigneesByTicket.get(ticket.ticket_id) ?? [],
      }
    })
  } catch (err) {
    throw handleError(err, "Exception for getTickets", {
      principal_id,
      filters,
    })
  }
}

/**
 * Returns the number of active tickets, assigned to the principal, with new content not viewed by them.
 *
 * It will also increase whenever someone sends a new message under the ticket, and decrease when the
 * principal views the ticket again.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 */
export const ACTIVE_TICKET_STATUSES = ["open", "in_progress", "waiting_on_customer"]
export async function getUnreadAssignedTicketCount(fdm: FdmHelpdeskType, principal_id: string) {
  return getTicketCount(fdm, principal_id, {
    notViewedBy: [principal_id],
    assignees: [principal_id],
    statuses: ACTIVE_TICKET_STATUSES,
  })
}

/**
 * Returns the number of active tickets that the user has requested, with new content not viewed by them.
 *
 * It is limited to tickets that the principal is able to view.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 */
export async function getUnreadRequestedTicketCount(fdm: FdmHelpdeskType, principal_id: string) {
  return getTicketCount(fdm, principal_id, {
    notViewedBy: [principal_id],
    requesterIds: [principal_id],
    statuses: ACTIVE_TICKET_STATUSES,
  })
}

/**
 * Returns the number of active tickets that are not yet assigned to anyone.
 *
 * It is limited to tickets that the principal is able to view.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 */
export async function getUnassignedTicketCount(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
) {
  return getTicketCount(fdm, principal_id, {
    assigned: false,
    statuses: ACTIVE_TICKET_STATUSES,
  })
}

/**
 * Returns the total count of tickets visible to the principal after applying filters.
 *
 * It is limited to tickets that the principal is able to view.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 * @param filters Optional filters for status, priority, requester, tags, assignees, text search, and
 * pagination.
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

/**
 * List tickets that match the given filters, sorted according to the sorting strategy.
 * If `selectCount` is true the total number of results with the same filters will be returned instead.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s) performing the query.
 * @param selectCount Whether to return the total count instead
 * @param filters Optional filters for status, priority, requester, tags, assignees, text search, and
 * pagination.
 * @param sorting Sorting strategy to use.
 */
async function selectTickets(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  selectCount: boolean,
  filters: TicketFilters = {},
  sorting: TicketSorting = "created",
) {
  const principal_ids = Array.isArray(principal_id) ? principal_id : [principal_id]

  const helpdeskReadPermission = await getHelpdeskPermission(
    fdm,
    "helpdesk",
    "read",
    "",
    principal_id,
  )

  // Override user filter if they should only be able to see their own tickets
  const requesterIds = !helpdeskReadPermission ? principal_ids : filters.requesterIds

  const whereClause = getTicketWhereClause(fdm, { ...filters, requesterIds })

  const isFilteringText = typeof filters.text === "string" && filters.text.trim().length > 0

  if (selectCount) {
    let query = fdm
      .select({
        count: sql<number>`cast(count(distinct ${schema.tickets.ticket_id}) as integer)`,
      })
      .from(schema.tickets)
      .leftJoin(
        schema.ticketViews,
        and(
          eq(schema.ticketViews.ticket_id, schema.tickets.ticket_id),
          inArray(schema.ticketViews.actor_id, principal_ids),
        ),
      )

    if (isFilteringText) {
      query = query.leftJoin(
        schema.messages,
        and(
          eq(schema.messages.ticket_id, schema.tickets.ticket_id),
          helpdeskReadPermission ? undefined : not(schema.messages.is_internal),
        ),
      )
    }

    return await query.where(whereClause)
  }

  // If actually returning tickets, ensure either priority, text relevance, or creation date ordering
  const priorityRankQuery =
    sorting === "priority"
      ? sql<number>`CASE
    WHEN ${schema.tickets.priority} = 'low' THEN -2
    WHEN ${schema.tickets.priority} = 'normal' THEN -1
    WHEN ${schema.tickets.priority} = 'high' THEN 1
    WHEN ${schema.tickets.priority} = 'urgent' THEN 2
    ELSE 0 END`
      : undefined
  const textRelevanceQuery =
    sorting === "text_relevance" && isFilteringText
      ? sql<number>`GREATEST(
                ts_rank(
                    setweight(to_tsvector('dutch', ${schema.tickets.ticket_ref} || ' ' || coalesce(${schema.tickets.subject}, '')), 'A'),
                    websearch_to_tsquery('dutch', ${filters.text})
                ),
                max(ts_rank(
                    setweight(to_tsvector('dutch', coalesce(${schema.messages.body}, '')), 'B'),
                    websearch_to_tsquery('dutch', ${filters.text})
                ))
            )`
      : undefined

  let query = fdm
    .select({
      ...ticketColumns,
      viewed_at: max(schema.ticketViews.viewed_at),
      // Select columns necessary for the ordering
      ...(priorityRankQuery ? { priority_rank: priorityRankQuery } : {}),
      ...(textRelevanceQuery ? { text_relevance: textRelevanceQuery } : {}),
    })
    .from(schema.tickets)
    // TODO: check if each agent has viewed, not only one of them
    .leftJoin(
      schema.ticketViews,
      and(
        eq(schema.ticketViews.ticket_id, schema.tickets.ticket_id),
        inArray(schema.ticketViews.actor_id, principal_ids),
      ),
    )

  if (isFilteringText) {
    query = query.leftJoin(
      schema.messages,
      and(
        eq(schema.messages.ticket_id, schema.tickets.ticket_id),
        helpdeskReadPermission ? undefined : not(schema.messages.is_internal),
      ),
    )
  }

  query = query
    .where(whereClause)
    .groupBy(schema.tickets.ticket_id)
    .orderBy((t) => {
      if (sorting === "priority" && t.priority_rank) {
        return [desc(t.priority_rank), desc(t.created)]
      }

      if (sorting === "text_relevance" && t.text_relevance) {
        return [desc(t.text_relevance as SQL<number>), desc(t.created)]
      }

      return [desc(t.created)]
    }) as typeof query

  if (filters.pageOffset) {
    query = query.offset(filters.pageOffset) as typeof query
  }

  if (filters.pageLimit) {
    query = query.limit(filters.pageLimit) as typeof query
  }

  const tickets = await query

  // Pick the necessary fields before returning
  return tickets.map((ticket) => {
    const { priority_rank: _priority_rank, text_relevance: _text_relevance, ...baseTicket } = ticket
    return baseTicket
  })
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
      ...SPACES.map((s) => body.indexOf(s, bodyCurrentIndex)).filter((x) => x !== -1),
    )
    const word = ` ${body.slice(bodyCurrentIndex, bodyNextIndex)}`
    if (subject.length + word.length <= MAX_SUBJECT_LENGTH + 1) {
      subject += word
    } else {
      if (subject.length < MIN_SUBJECT_LENGTH) {
        subject += word.slice(0, MIN_SUBJECT_LENGTH - subject.length + 1)
      }
      break
    }
    bodyCurrentIndex = bodyNextIndex + 1
    while (bodyCurrentIndex < body.length && SPACES.includes(body[bodyCurrentIndex])) {
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
        sender_type: "customer",
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

/**
 * Creates a new ticket (channel `"email"`) and its first message in a single transaction, for an inbound
 * email that could not be matched to an existing ticket.
 * The body is HTML-escaped and a subject line is derived from the first few words.
 *
 * `requester_id` is optional: when the sender's email address cannot be matched to a known
 * fdm-authn user, pass `undefined`/omit it and the ticket is stored with `requester_id: null` and
 * `requester_email` set instead. In that case, the first message's `sender_id` is set to null too.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param requester_email Email address the inbound email was sent from.
 * @param body The opening message body.
 * @param requester_id Optional ID of the matched fdm-authn user who sent the email, if known.
 * @param options Optional priority and farm context to associate with the ticket.
 * @returns The `ticket_id` of the newly created ticket.
 */
export async function createTicketFromInboundEmail(
  fdm: FdmHelpdeskType,
  requester_email: schema.TicketTypeInsert["requester_email"],
  body: schema.MessageTypeInsert["body"],
  requester_id?: schema.MessageTypeInsert["sender_id"],
  options?: CreateTicketOptions,
) {
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
          requester_id: requester_id ?? null,
          requester_email: requester_email,
          subject: getDefaultSubjectLine(sanitizedBody),
          channel: "email",
          priority: options?.priority,
          context_farm_id: options?.context?.b_id_farm,
        },
      ])

      await tx.insert(schema.messages).values({
        ticket_id: ticket_id,
        sender_id: requester_id ?? null,
        message_id: message_id,
        sender_type: "customer",
        body: sanitizedBody,
      })

      return ticket_id
    })
  } catch (e) {
    throw handleError(e, "Exception for createTicketFromInboundEmail", {
      ...options,
      requester_email,
    })
  }
}

/**
 * Updates the ticket subject and priority without doing any permission checks.
 * Intended for use during AI triage.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket to update.
 * @param subject The new ticket subject.
 * @param priority The new priority.
 */
export async function updateTicketSubjectAndPriorityUnchecked(
  fdm: FdmHelpdeskType,
  ticket_id: schema.TicketTypeSelect["ticket_id"],
  subject?: string,
  priority?: string,
) {
  try {
    await fdm
      .update(schema.tickets)
      .set({ subject: subject, priority: priority, updated: sql`now()` })
      .where(eq(schema.tickets.ticket_id, ticket_id))
  } catch (e) {
    throw handleError(e, "Exception for updateTicketSubjectAndPriorityUnchecked", {
      ticket_id,
      priority,
    })
  }
}

/**
 * Updates the ticket subject.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have agent-side write access to the ticket.
 * @param ticket_id ID of the ticket to update.
 * @param subject The new ticket subject.
 */
export async function updateTicketSubject(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  ticket_id: schema.TicketTypeSelect["ticket_id"],
  subject?: string,
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "ticket-agent-side",
      "write",
      ticket_id,
      principal_id,
      "updateTicketPriority",
    )

    await fdm
      .update(schema.tickets)
      .set({ subject: subject, updated: sql`now()` })
      .where(eq(schema.tickets.ticket_id, ticket_id))
  } catch (e) {
    throw handleError(e, "Exception for updateTicketSubject", {
      principal_id,
      ticket_id,
    })
  }
}

/**
 * Updates the ticket priority.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have agent-side write access to the ticket.
 * @param ticket_id ID of the ticket to update.
 * @param priority The new priority.
 */
export async function updateTicketPriority(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  ticket_id: schema.TicketTypeSelect["ticket_id"],
  priority?: string,
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "ticket-agent-side",
      "write",
      ticket_id,
      principal_id,
      "updateTicketPriority",
    )

    await fdm
      .update(schema.tickets)
      .set({ priority: priority, updated: sql`now()` })
      .where(eq(schema.tickets.ticket_id, ticket_id))
  } catch (e) {
    throw handleError(e, "Exception for updateTicketPriority", {
      principal_id,
      ticket_id,
      priority,
    })
  }
}

const ALLOWED_TICKET_STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "pending", "waiting_on_customer", "resolved", "closed"],
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
export function validateTicketStatusTransition(from: string, to: string): boolean {
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
      throw new Error(`Invalid status transition: ${ticket.status} → ${status}`)
    }

    await fdm
      .update(schema.tickets)
      .set({
        status: status,
        updated: sql`now()`,
        resolved_at: status === "resolved" ? sql`now()` : undefined,
        closed_at:
          status === "closed"
            ? sql`CASE WHEN ${isNull(schema.tickets.closed_at)} THEN now() ELSE ${schema.tickets.closed_at} END`
            : null,
      })
      .where(eq(schema.tickets.ticket_id, ticket_id))
  } catch (err) {
    throw handleError(err, "Exception for updateTicketStatus")
  }
}

/**
 * Marks the ticket as viewed by the actor.
 * If any of them has already viewed the ticket, the view timestamp will be updated.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have agent-side write access to the ticket.
 * @param ticket_id ID of the ticket to mark as viewed.
 */
export async function markTicketAsViewed(
  fdm: FdmHelpdeskType,
  actor_id: schema.TicketViewTypeInsert["actor_id"],
  ticket_id: schema.TicketViewTypeInsert["ticket_id"],
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "ticket-user-side",
      "read",
      ticket_id,
      actor_id,
      "markTicketAsViewed",
    )

    await fdm
      .insert(schema.ticketViews)
      .values({
        ticket_id: ticket_id,
        actor_id: actor_id,
        viewed_at: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [schema.ticketViews.ticket_id, schema.ticketViews.actor_id],
        set: { viewed_at: sql`now()` },
      })
  } catch (err) {
    throw handleError(err, "Exception for markTicketAsViewed")
  }
}

/**
 * Removes all records of a ticket being viewed, indicating to those who have read it before that there are
 * new things to check out.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket to mark as not viewed.
 */
export async function markTicketAsNotViewedByAll(
  fdm: FdmHelpdeskType,
  ticket_id: schema.TicketViewTypeSelect["ticket_id"],
) {
  try {
    await fdm.delete(schema.ticketViews).where(eq(schema.ticketViews.ticket_id, ticket_id))
  } catch (err) {
    throw handleError(err, "Exception for markTicketAsNotViewedByAll")
  }
}

/**
 * Updates ticket.requester_id and message.sender_ids for each ticket that was sent by the email and had no
 * recorded requester principal ID.
 *
 * This is intended for when users who have been contacting support via e-mail make a proper account on the
 * application, so that they can see their previous tickets on the integrated helpdesk app when they log in.
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param requester_id Requester ID (and also message sender_id) to set.
 * @param requester_email Requester e-mail to match.
 */
export async function moveInboundEmailTicketsToPrincipalUnchecked(
  fdm: FdmHelpdeskType,
  requester_id: string,
  requester_email: string,
) {
  try {
    // Subquery that updates tickets
    const sq = fdm.$with("sq").as(
      fdm
        .update(schema.tickets)
        .set({ requester_id: requester_id })
        .where(
          and(
            isNull(schema.tickets.requester_id),
            eq(sql`lower(${schema.tickets.requester_email})`, requester_email.trim().toLowerCase()),
          ),
        )
        .returning({ ticket_id: schema.tickets.ticket_id }),
    )

    // Query that calls the above query and also updates the messages
    await fdm
      .with(sq)
      .update(schema.messages)
      .set({ sender_id: requester_id })
      .where(
        and(
          isNull(schema.messages.sender_id),
          exists(fdm.select().from(sq).where(eq(sq.ticket_id, schema.messages.ticket_id))),
        ),
      )
  } catch (err) {
    throw handleError(err, "Exception for moveInboundEmailTicketsToPrincipalUnchecked", {
      requester_id,
    })
  }
}
