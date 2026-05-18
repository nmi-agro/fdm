import { type FdmType, handleError, type PrincipalId } from "@nmi-agro/fdm-core"
import { and, eq, gte, inArray, isNull, lte, not, sql } from "drizzle-orm"
import { checkHelpdeskPermission, getHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"
import type {
    IncludeDeletedFilter,
    PaginationFilter,
    SenderFilter,
    TimeframeFilter,
} from "./util"

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

async function getCanReadInternalMessages(
    fdm: FdmType,
    principal_id: PrincipalId,
) {
    return await getHelpdeskPermission(
        fdm,
        "helpdesk",
        "read",
        "",
        principal_id,
    )
}
const PERMISSION_ERROR_MESSAGE =
    "Principal does not have permission to perform this action"

export async function getMessage(
    fdm: FdmType,
    principal_id: PrincipalId,
    message_id: schema.MessageTypeSelect["message_id"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "message",
            "read",
            message_id,
            principal_id,
            "getMessage",
        )

        const found = await fdm
            .select(messageColumns)
            .from(schema.messages)
            .leftJoin(
                schema.agents,
                eq(schema.messages.sender_id, schema.agents.agent_id),
            )
            .where(eq(schema.messages.message_id, message_id))
            .limit(1)

        return found[0]
    } catch (err) {
        throw handleError(err, "Exception for addMessage", {
            message_id,
            principal_id,
        })
    }
}

export async function getMessagesForTicket(
    fdm: FdmType,
    principal_id: PrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
    filters?: TimeframeFilter &
        SenderFilter &
        IncludeDeletedFilter &
        PaginationFilter,
): Promise<Message[]> {
    const pageOffset =
        typeof filters?.pageOffset === "number"
            ? Math.max(0, filters.pageOffset)
            : 0
    const pageLimit =
        typeof filters?.pageLimit === "number"
            ? Math.max(1, filters.pageLimit)
            : 20

    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-user-side",
            "read",
            ticket_id,
            principal_id,
            "getMessagesForTicket",
        )

        const canReadInternalMessages = await getCanReadInternalMessages(
            fdm,
            principal_id,
        )

        if (filters?.includeDeleted && !canReadInternalMessages) {
            throw new Error(PERMISSION_ERROR_MESSAGE)
        }

        return await fdm
            .select(messageColumns)
            .from(schema.messages)
            .leftJoin(
                schema.agents,
                eq(schema.messages.sender_id, schema.agents.agent_id),
            )
            .where(
                and(
                    eq(schema.messages.ticket_id, ticket_id),
                    !canReadInternalMessages
                        ? not(schema.messages.is_internal)
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
                    Array.isArray(filters?.sentBy)
                        ? inArray(schema.messages.sender_id, filters.sentBy)
                        : undefined,
                ),
            )
            .orderBy(schema.messages.created)
            .offset(pageOffset)
            .limit(pageLimit)
    } catch (err) {
        throw handleError(err, "Exception for addMessage", {
            principal_id,
            ticket_id,
        })
    }
}

export async function addMessage(
    fdm: FdmType,
    ticket_id: schema.MessageTypeInsert["ticket_id"],
    sender_id: schema.MessageTypeInsert["sender_id"],
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

        if (
            is_internal &&
            !(await getCanReadInternalMessages(fdm, sender_id))
        ) {
            throw new Error(PERMISSION_ERROR_MESSAGE)
        }

        const message_id = createId()
        await fdm.insert(schema.messages).values([
            {
                ticket_id: ticket_id,
                message_id: message_id,
                sender_id: sender_id,
                body: body,
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

export async function updateMessage(
    fdm: FdmType,
    principal_id: PrincipalId,
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

        if (
            is_internal &&
            !(await getCanReadInternalMessages(fdm, principal_id))
        ) {
            throw new Error(PERMISSION_ERROR_MESSAGE)
        }

        await fdm
            .update(schema.messages)
            .set({
                body: body,
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

export async function deleteMessage(
    fdm: FdmType,
    principal_id: PrincipalId,
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
