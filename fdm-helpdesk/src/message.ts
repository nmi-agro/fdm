import { and, eq, sql } from "drizzle-orm"
import type { HelpdeskPrincipalId } from "./authorization.types"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import type { MessageFilters } from "./filter.types"
import { checkHelpdeskPermission, getHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import { getMessageWhereClause } from "./filter"
import { createId } from "./id"
import { getPageOffsetAndLimit } from "./pagination"
import { escapeHTML } from "./sanitization"

/** A message record joined with the sender's display name. */
export type Message = schema.MessageTypeSelect & {
  sender_name: schema.AgentTypeSelect["display_name"] | null
}

const messageColumns = {
  ticket_id: schema.messages.ticket_id,
  message_id: schema.messages.message_id,
  sender_id: schema.messages.sender_id,
  sender_type: schema.messages.sender_type,
  sender_name: sql<
    string | null
  >`case when ${eq(schema.messages.sender_type, "agent")} then ${schema.agents.display_name} end`,
  body: schema.messages.body,
  is_internal: schema.messages.is_internal,
  created: schema.messages.created,
  updated: schema.messages.updated,
  deleted_at: schema.messages.deleted_at,
}

/**
 * Whether the principal can read internal messages in the helpdesk.
 * This requires the ability to read everything on the helpdesk.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read permission for the helpdesk.
 * @returns a permission grant object if the principal has permission, otherwise null.
 */
async function getCanReadInternalMessages(fdm: FdmHelpdeskType, principal_id: HelpdeskPrincipalId) {
  return await getHelpdeskPermission(fdm, "helpdesk", "read", "", principal_id)
}

const PERMISSION_ERROR_MESSAGE = "Principal does not have permission to perform this action"

/**
 * Retrieves a single message by ID.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read permission for the message.
 * @param message_id ID of the message to retrieve.
 * @returns The message record including the sender's display name, or `undefined` if not found.
 */
export async function getMessage(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  message_id: schema.MessageTypeSelect["message_id"],
) {
  try {
    await checkHelpdeskPermission(fdm, "message", "read", message_id, principal_id, "getMessage")

    const found = await fdm
      .select(messageColumns)
      .from(schema.messages)
      .leftJoin(schema.agents, eq(schema.messages.sender_id, schema.agents.agent_id))
      .where(eq(schema.messages.message_id, message_id))
      .limit(1)

    return found[0]
  } catch (err) {
    throw handleError(err, "Exception for getMessage", {
      message_id,
      principal_id,
    })
  }
}

/**
 * Retrieves all messages for a ticket, with optional filtering and pagination.
 * Internal messages are hidden from non-agent principals.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read access to the ticket.
 * @param ticket_id ID of the ticket whose messages to fetch.
 * @param filters Optional filters for pagination, internal status, date range, and soft-deleted messages.
 * @returns An array of messages ordered by creation time.
 */
export async function getMessagesForTicket(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  ticket_id: schema.TicketTypeSelect["ticket_id"],
  filters: MessageFilters = {},
): Promise<Message[]> {
  try {
    const { pageOffset, pageLimit } = getPageOffsetAndLimit(filters, 0)
    await checkHelpdeskPermission(
      fdm,
      "ticket-user-side",
      "read",
      ticket_id,
      principal_id,
      "getMessagesForTicket",
    )

    const canReadInternalMessages = await getCanReadInternalMessages(fdm, principal_id)

    const isInternal = canReadInternalMessages ? filters?.isInternal : false
    if (
      !canReadInternalMessages &&
      (filters?.includeDeleted || (filters?.isInternal && !isInternal))
    ) {
      throw new Error(PERMISSION_ERROR_MESSAGE)
    }

    let query = fdm
      .select(messageColumns)
      .from(schema.messages)
      .leftJoin(schema.agents, eq(schema.messages.sender_id, schema.agents.agent_id))
      .where(
        and(
          eq(schema.messages.ticket_id, ticket_id),
          getMessageWhereClause({ ...filters, isInternal }),
        ),
      )
      .orderBy(schema.messages.created)
      .offset(pageOffset)

    if (pageLimit) {
      query = query.limit(pageLimit) as typeof query
    }

    return await query
  } catch (err) {
    throw handleError(err, "Exception for getMessagesForTicket", {
      principal_id,
      ticket_id,
    })
  }
}

/**
 * Adds a new message to an existing ticket. The body is HTML-escaped before storage.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket the message belongs to.
 * @param sender_id ID of the user or agent sending the message.
 * @param sender_type Whether the sender is a `"customer"` or an `"agent"`.
 * @param body The message text to store.
 * @param is_internal When `true`, marks the message as an internal note visible only to agents.
 * @returns The `message_id` of the newly created message.
 */
export async function addMessage(
  fdm: FdmHelpdeskType,
  ticket_id: schema.MessageTypeInsert["ticket_id"],
  sender_id: string,
  sender_type: "customer" | "agent",
  body: schema.MessageTypeInsert["body"],
  is_internal?: schema.MessageTypeInsert["is_internal"],
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "ticket-user-side",
      "write",
      ticket_id,
      sender_id,
      "addMessage",
    )

    if (is_internal && !(await getCanReadInternalMessages(fdm, sender_id))) {
      throw new Error(PERMISSION_ERROR_MESSAGE)
    }

    const message_id = createId()
    await fdm.insert(schema.messages).values([
      {
        ticket_id: ticket_id,
        message_id: message_id,
        sender_id: sender_id,
        body: escapeHTML(body),
        sender_type: sender_type,
        is_internal: is_internal,
      },
    ])

    return message_id
  } catch (err) {
    throw handleError(err, "Exception for addMessage", {
      ticket_id,
      sender_id,
    })
  }
}

/**
 * Adds a new message to an existing ticket. The body is HTML-escaped before storage.
 *
 * No permission checks are performed, therefore the caller needs to follow a strategy to not let arbitrary
 * people add messages.
 *
 * `sender_id` is optional: when the inbound email's sender could not be matched to a known fdm-authn user,
 * pass `undefined`/omit it and `sender_id` falls back to the ticket's own `ticket_id` as a placeholder
 * value (matching the convention used by {@link createTicketFromInboundEmail}).
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param ticket_id ID of the ticket the message belongs to.
 * @param body The message text to store.
 * @param sender_id Optional ID of the matched fdm-authn user sending the message, if known.
 * @returns The `message_id` of the newly created message.
 */
export async function addMessageFromInboundEmailUnchecked(
  fdm: FdmHelpdeskType,
  ticket_id: schema.MessageTypeInsert["ticket_id"],
  body: schema.MessageTypeInsert["body"],
  sender_id?: schema.MessageTypeInsert["sender_id"],
) {
  try {
    const ticket = await fdm
      .select({ ticket_id: schema.tickets.ticket_id })
      .from(schema.tickets)
      .where(eq(schema.tickets.ticket_id, ticket_id))
      .limit(1)

    if (ticket.length === 0) {
      throw new Error(PERMISSION_ERROR_MESSAGE)
    }

    const message_id = createId()
    await fdm.insert(schema.messages).values([
      {
        ticket_id: ticket_id,
        message_id: message_id,
        sender_id: sender_id ?? null,
        body: escapeHTML(body),
        sender_type: "customer",
      },
    ])

    return message_id
  } catch (err) {
    throw handleError(err, "Exception for addMessageFromInboundEmail", {
      ticket_id,
      sender_id,
    })
  }
}

/**
 * Updates the body and/or internal flag of an existing message.
 * Only agents with helpdesk read permission may mark a message as internal.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have write permission for the message.
 * @param message_id ID of the message to update.
 * @param body New body text, or `undefined` to leave it unchanged.
 * @param is_internal New internal flag, or `undefined` to leave it unchanged.
 */
export async function updateMessage(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  message_id: schema.MessageTypeInsert["message_id"],
  body?: schema.MessageTypeInsert["body"],
  is_internal?: schema.MessageTypeInsert["is_internal"],
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "message",
      "write",
      message_id,
      principal_id,
      "updateMessage",
    )

    if (is_internal && !(await getCanReadInternalMessages(fdm, principal_id))) {
      throw new Error(PERMISSION_ERROR_MESSAGE)
    }

    await fdm
      .update(schema.messages)
      .set({
        body: body !== undefined && body !== null ? escapeHTML(body) : undefined,
        is_internal: is_internal,
        updated: sql`now()`,
      })
      .where(eq(schema.messages.message_id, message_id))
  } catch (err) {
    throw handleError(err, "Exception for updateMessage", {
      message_id,
      principal_id,
      is_internal,
    })
  }
}

/**
 * Soft-deletes a message by setting its `deleted_at` timestamp.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have write permission for the message.
 * @param message_id ID of the message to delete.
 */
export async function deleteMessage(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  message_id: schema.MessageTypeInsert["message_id"],
) {
  try {
    await checkHelpdeskPermission(
      fdm,
      "message",
      "write",
      message_id,
      principal_id,
      "deleteMessage",
    )

    await fdm
      .update(schema.messages)
      .set({
        deleted_at: sql`now()`,
      })
      .where(eq(schema.messages.message_id, message_id))
  } catch (err) {
    throw handleError(err, "Exception for deleteMessage", {
      message_id,
      principal_id,
    })
  }
}
