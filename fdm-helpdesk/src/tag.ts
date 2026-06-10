import { and, asc, eq, inArray } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import type { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError } from "./error"
import type { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"

/** Full tag record as stored in the database. */
export type Tag = schema.TagTypeSelect
/** A lightweight tag object containing only the fields needed for display. */
export type TagSummary = Pick<Tag, "tag_id" | "name" | "color">

const tagSummaryColumns = {
    tag_id: schema.tags.tag_id,
    name: schema.tags.name,
    color: schema.tags.color,
}

/**
 * Retrieves a single tag by ID. Throws if no tag with the given ID exists.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @param tag_id ID of the tag to retrieve.
 * @returns The matching tag record.
 */
export async function getTag(fdm: FdmHelpdeskType, tag_id: string) {
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

async function tryGetTagByName(fdm: FdmHelpdeskType, tag_name: string) {
    try {
        const found = await fdm
            .select()
            .from(schema.tags)
            .where(eq(schema.tags.name_lower, tag_name.toLowerCase()))
            .limit(1)

        if (found.length === 0) {
            return null
        }

        return found[0]
    } catch (err) {
        throw handleError(err, "Exception for tryGetTagByName", { tag_name })
    }
}

/**
 * Retrieves all tags in the helpdesk.
 *
 * @param fdm The FDM instance providing the connection to the database.
 * @returns An array of all tag records.
 */
export async function getTags(fdm: FdmHelpdeskType) {
    try {
        return await fdm.select().from(schema.tags)
    } catch (err) {
        throw handleError(err, "Exception for getTags")
    }
}

/**
 * Retrieves the tags associated with the given tickets, grouped by ticket ID.
 * Requires agent-side read permission for each ticket.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param agent_id The principal identifier(s); must have agent-side read permission for each ticket.
 * @param ticket_ids IDs of the tickets whose tags to fetch.
 * @returns A Map from ticket ID to an array of {@link TagSummary} objects.
 */
export async function getTagsForTickets(
    fdm: FdmHelpdeskType,
    agent_id: HelpdeskPrincipalId,
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

function validateName(name: string) {
    if (name.length === 0) {
        throw new Error("Tag name cannot be empty")
    }
}

/**
 * Creates a new tag. Tag names must be unique (case-insensitive). Requires helpdesk write permission.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have helpdesk write permission.
 * @param name Display name for the tag. Must be non-empty and unique.
 * @param color Optional hex color code for the tag.
 * @param description Optional longer description for the tag.
 * @returns The `tag_id` of the newly created tag.
 */
export async function createTag(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    name: schema.TagTypeInsert["name"],
    color?: schema.TagTypeInsert["color"],
    description?: schema.TagTypeInsert["description"],
): Promise<schema.TagTypeSelect["tag_id"]> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "createTag",
        )
        validateName(name)
        return await fdm.transaction(async (tx) => {
            const matching = await tryGetTagByName(tx, name)
            if (matching) {
                throw new Error("Another tag with name already exists")
            }
            const tag_id = createId()
            await tx.insert(schema.tags).values([
                {
                    tag_id: tag_id,
                    name: name,
                    name_lower: name.toLowerCase(),
                    description: description,
                    color: color,
                },
            ])
            return tag_id
        })
    } catch (err) {
        throw handleError(err, "Exception in createTag", {
            name,
            color,
            description,
        })
    }
}

/**
 * Updates one or more fields of an existing tag. Requires helpdesk write permission.
 * Throws if the tag does not exist or the new name conflicts with another tag.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have helpdesk write permission.
 * @param tag_id ID of the tag to update.
 * @param name New display name, or `undefined` to leave it unchanged.
 * @param color New color, or `undefined` to leave it unchanged.
 * @param description New description, or `undefined` to leave it unchanged.
 */
export async function updateTag(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    tag_id: string,
    name?: schema.TagTypeInsert["name"],
    color?: schema.TagTypeInsert["color"],
    description?: schema.TagTypeInsert["description"],
) {
    try {
        const isNameProvided = typeof name !== "undefined" && name !== null
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "updateTag",
        )
        if (isNameProvided) validateName(name)
        return await fdm.transaction(async (tx) => {
            // Check if tag exists
            await getTag(tx, tag_id)

            // Check if there will be a name collision
            if (isNameProvided) {
                const matching = await tryGetTagByName(tx, name)
                if (matching && matching.tag_id !== tag_id) {
                    throw new Error("Another tag with name already exists")
                }
            }

            // Update
            await tx
                .update(schema.tags)
                .set({
                    name: name,
                    name_lower: isNameProvided ? name.toLowerCase() : undefined,
                    description: description,
                    color: color,
                })
                .where(eq(schema.tags.tag_id, tag_id))
        })
    } catch (err) {
        throw handleError(err, "Exception in updateTag", {
            name,
            color,
            description,
        })
    }
}

/**
 * Permanently deletes a tag.
 *
 * It first removes the tag from each ticket, ensuring the database contraints won't be violated.
 * Then it deletes the tag.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have helpdesk write permission.
 * @param tag_id ID of the tag to delete.
 */
export async function deleteTag(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    tag_id: schema.TagTypeSelect["tag_id"],
) {
    try {
        await checkHelpdeskPermission(
            fdm,
            "helpdesk",
            "write",
            "",
            principal_id,
            "deleteTag",
        )

        await fdm.transaction(async (tx) => {
            // Remove the tag from each ticket
            await tx
                .delete(schema.ticketTagsMap)
                .where(eq(schema.ticketTagsMap.tag_id, tag_id))

            // Delete the tag
            await tx.delete(schema.tags).where(eq(schema.tags.tag_id, tag_id))
        })
    } catch (err) {
        throw handleError(err, "Exception for deleteTag")
    }
}

/**
 * Attaches a tag to a ticket. No-op if the tag is already attached. Requires agent-side write permission.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have agent-side write permission for the ticket.
 * @param ticket_id ID of the ticket to tag.
 * @param tag_id ID of the tag to attach.
 */
export async function addTagToTicket(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
    tag_id: schema.TagTypeSelect["tag_id"],
): Promise<void> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            principal_id,
            "addTagToTicket",
        )

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
        throw handleError(err, "Error in addTagToTicket", {
            principal_id,
            ticket_id,
            tag_id,
        })
    }
}

/**
 * Detaches a tag from a ticket. Requires agent-side write permission.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have agent-side write permission for the ticket.
 * @param ticket_id ID of the ticket to modify.
 * @param tag_id ID of the tag to detach.
 */
export async function removeTagFromTicket(
    fdm: FdmHelpdeskType,
    principal_id: HelpdeskPrincipalId,
    ticket_id: schema.TicketTypeSelect["ticket_id"],
    tag_id: schema.TagTypeSelect["tag_id"],
): Promise<void> {
    try {
        await checkHelpdeskPermission(
            fdm,
            "ticket-agent-side",
            "write",
            ticket_id,
            principal_id,
            "removeTagFromTicket",
        )

        await fdm
            .delete(schema.ticketTagsMap)
            .where(
                and(
                    eq(schema.ticketTagsMap.ticket_id, ticket_id),
                    eq(schema.ticketTagsMap.tag_id, tag_id),
                ),
            )
    } catch (err) {
        throw handleError(err, "Error in removeTagFromTicket", {
            principal_id,
            ticket_id,
            tag_id,
        })
    }
}
