import { type FdmType, handleError, type PrincipalId } from "@nmi-agro/fdm-core"
import { and, asc, eq, inArray } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import * as schema from "./db/schema-helpdesk"
import { createId } from "./id"

export type Tag = schema.TagTypeSelect
export type TagSummary = Pick<Tag, "tag_id" | "name" | "color">

const tagSummaryColumns = {
    tag_id: schema.tags.tag_id,
    name: schema.tags.name,
    color: schema.tags.color,
}

export async function getTag(fdm: FdmType, tag_id: string) {
    try {
        const found = await fdm
            .select()
            .from(schema.tags)
            .where(eq(schema.tags.tag_id, tag_id))
            .limit(1)

        if (found.length === 0) {
            throw new Error("Tag not found")
        }

        return found[0]
    } catch (err) {
        throw handleError(err, "Exception for getTag", { tag_id })
    }
}

export async function getTags(fdm: FdmType) {
    try {
        return await fdm.select().from(schema.tags)
    } catch (err) {
        throw handleError(err, "Exception for getTags")
    }
}

export async function getTagsForTickets(
    fdm: FdmType,
    agent_id: PrincipalId,
    ticket_ids: string[],
): Promise<Map<schema.TicketTypeSelect["ticket_id"], TagSummary[]>> {
    try {
        await Promise.all(
            ticket_ids.map((ticket_id) =>
                checkHelpdeskPermission(
                    fdm,
                    "ticket-agent-side",
                    "read",
                    ticket_id,
                    agent_id,
                    "getTagsForTickets",
                ),
            ),
        )

        const allTags = await fdm
            .select({
                ticket_id: schema.ticketTagsMap.ticket_id,
                ...tagSummaryColumns,
            })
            .from(schema.ticketTagsMap)
            .innerJoin(
                schema.tags,
                eq(schema.ticketTagsMap.tag_id, schema.tags.tag_id),
            )
            .where(inArray(schema.ticketTagsMap.ticket_id, ticket_ids))
            .orderBy(schema.ticketTagsMap.ticket_id, asc(schema.tags.name))

        const result = new Map<
            schema.TicketTypeSelect["ticket_id"],
            TagSummary[]
        >()

        for (const relatedTag of allTags) {
            const { ticket_id, ...tag } = relatedTag
            const existing = result.get(ticket_id)
            if (existing) {
                existing.push(tag)
            } else {
                result.set(ticket_id, [tag])
            }
        }

        return result
    } catch (err) {
        throw handleError(err, "Exception for getTagsForTickets", {
            agent_id,
            ticket_ids,
        })
    }
}

export async function createTag(
    fdm: FdmType,
    principal_id: PrincipalId,
    name: schema.TagTypeInsert["name"],
    color: schema.TagTypeInsert["color"],
    description: schema.TagTypeInsert["description"],
): Promise<schema.TagTypeSelect["tag_id"]> {
    await checkHelpdeskPermission(
        fdm,
        "helpdesk",
        "write",
        "",
        principal_id,
        "createTag",
    )
    try {
        const tag_id = createId()
        await fdm.insert(schema.tags).values([
            {
                tag_id: tag_id,
                name: name,
                description: description,
                color: color,
            },
        ])
        return tag_id
    } catch (err) {
        throw handleError(err, "Exception in createTag", {
            name,
            color,
            description,
        })
    }
}

export async function addTagToTicket(
    fdm: FdmType,
    principal_id: PrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
    tag_id: schema.TagTypeSelect["tag_id"],
): Promise<void> {
    await checkHelpdeskPermission(
        fdm,
        "ticket-agent-side",
        "write",
        ticket_id,
        principal_id,
        "addTagToTicket",
    )

    try {
        await fdm
            .insert(schema.ticketTagsMap)
            .values([
                {
                    ticket_id: ticket_id,
                    tag_id: tag_id,
                },
            ])
            .onConflictDoNothing()
    } catch (err) {
        throw handleError(err, "Error in addTagToTicket")
    }
}

export async function removeTagFromTicket(
    fdm: FdmType,
    principal_id: PrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
    tag_id: schema.TagTypeSelect["tag_id"],
): Promise<void> {
    await checkHelpdeskPermission(
        fdm,
        "ticket-agent-side",
        "write",
        ticket_id,
        principal_id,
        "addTagToTicket",
    )

    try {
        await fdm
            .delete(schema.ticketTagsMap)
            .where(
                and(
                    eq(schema.ticketTagsMap.ticket_id, ticket_id),
                    eq(schema.ticketTagsMap.tag_id, tag_id),
                ),
            )
    } catch (err) {
        throw handleError(err, "Error in addTagToTicket")
    }
}
