import { and, asc, eq, exists, isNull, not, sql } from "drizzle-orm"
import { checkHelpdeskPermission } from "./authorization"
import { HelpdeskPrincipalId } from "./authorization.types"
import * as schema from "./db/schema-helpdesk"
import { handleError, PERMISSION_ERROR_MESSAGE } from "./error"
import { FdmHelpdeskType } from "./fdm-helpdesk.types"
import { createId } from "./id"
import { getCanReadInternalMessages } from "./message"

type Attachment = schema.AttachmentTypeSelect

/**
 * Gets the attachment with the given ID. It checks if the principal can read the
 * associated message.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read permission for the associated message.
 * @param attachment_id ID of the attachment to get.
 * @returns An attachment object.
 * @throws if the principal does not have access to the associated message or an attachment with such ID
 * does not exist.
 */
export async function getAttachment(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  attachment_id: schema.AttachmentTypeSelect["attachment_id"],
): Promise<Attachment> {
  try {
    const found = await fdm
      .select()
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.attachment_id, attachment_id),
          isNull(schema.attachments.deleted_at),
        ),
      )
      .limit(1)

    if (found.length === 0) {
      throw new Error(PERMISSION_ERROR_MESSAGE)
    }

    const attachment = found[0]

    await checkHelpdeskPermission(
      fdm,
      "message",
      "read",
      attachment.message_id,
      principal_id,
      "getAttachment",
    )

    return attachment
  } catch (err) {
    throw handleError(err, "Exception for getAttachment", { principal_id, attachment_id })
  }
}

/**
 * Gets all the attachments for the given message.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read permission for the message.
 * @param message_id ID of the message to list the attachments for.
 * @returns An array of attachment objects.
 * @throws if the principal does not have access to the given message or if it does not exist.
 */
export async function getAttachmentsForMessage(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  message_id: schema.AttachmentTypeSelect["message_id"],
): Promise<Attachment[]> {
  try {
    await checkHelpdeskPermission(
      fdm,
      "message",
      "read",
      message_id,
      principal_id,
      "getAttachmentsForMessage",
    )

    const attachments = await fdm
      .select()
      .from(schema.attachments)
      .where(
        and(eq(schema.attachments.message_id, message_id), isNull(schema.attachments.deleted_at)),
      )

    return attachments
  } catch (err) {
    throw handleError(err, "Exception for getAttachmentsForMessage", { principal_id, message_id })
  }
}

/**
 * Gets the attachments for each message under the given ticket.
 *
 * @param fdm The FDM instance providing the connection to the database.The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have read permission for the ticket.
 * @param ticket_id ID of the ticket to list the message attachments for.
 * @returns A Map from each message ID to the message's attachment objects.
 * @throws if the principal does not have access to the given ticket or if it does not exist.
 */
export async function getAttachmentsForTicket(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  ticket_id: schema.AttachmentTypeSelect["ticket_id"],
): Promise<Map<string, Attachment[]>> {
  try {
    await checkHelpdeskPermission(
      fdm,
      "ticket-user-side",
      "read",
      ticket_id,
      principal_id,
      "getAttachmentsForTicket",
    )

    const canReadInternalMessages = await getCanReadInternalMessages(fdm, principal_id)

    const attachments = await fdm
      .select()
      .from(schema.attachments)
      .where(
        and(
          isNull(schema.attachments.deleted_at),
          exists(
            fdm
              .select()
              .from(schema.messages)
              .where(
                and(
                  eq(schema.messages.ticket_id, ticket_id),
                  eq(schema.messages.message_id, schema.attachments.message_id),
                  !canReadInternalMessages ? not(schema.messages.is_internal) : undefined,
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(schema.attachments.message_id))

    const attachmentsMap = new Map<string, Attachment[]>()
    for (const attachment of attachments) {
      if (!attachmentsMap.has(attachment.message_id)) {
        attachmentsMap.set(attachment.message_id, [])
      }
      attachmentsMap.get(attachment.message_id)?.push(attachment)
    }

    return attachmentsMap
  } catch (err) {
    throw handleError(err, "Exception for getAttachmentsForTicket", { principal_id, ticket_id })
  }
}

/**
 * Adds an attachment to the given message. fdm-helpdesk does not care about what file_name, file_size,
 * mime_type, file_path are.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have write permission for the message.
 * @param message_id ID of the message to attach to.
 * @param file_name Name of the file, intended as the download name.
 * @param file_size Size of the linked file, in octets.
 * @param mime_type MIME type of the file.
 * @param file_path Path to the linked file which would allow retrieval from the storage service.
 * Occurrences of `{attachment_id}` will be substituted with the generated attachment ID.
 * @param uploaded_by ID of the principal who is attaching the file.
 * @returns the ID of the new attachment.
 * @throws if the principal cannot update the message or if it doesn't exist.
 */
export async function addAttachment(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  message_id: schema.AttachmentTypeInsert["message_id"],
  file_name: schema.AttachmentTypeInsert["file_name"],
  file_size: schema.AttachmentTypeInsert["file_size"],
  mime_type: schema.AttachmentTypeInsert["mime_type"],
  file_path: schema.AttachmentTypeInsert["file_path"],
  uploaded_by: schema.AttachmentTypeInsert["uploaded_by"],
): Promise<string> {
  try {
    await checkHelpdeskPermission(
      fdm,
      "message",
      "write",
      message_id,
      principal_id,
      "addAttachment",
    )

    const attachment_id = createId()

    await fdm.insert(schema.attachments).values({
      attachment_id: attachment_id,
      message_id: message_id,
      ticket_id:
        sql<string>`(SELECT ${schema.messages.ticket_id} FROM ${schema.messages} WHERE ${schema.messages.message_id} = ${message_id})` as unknown as string,
      file_name: file_name,
      file_size: file_size,
      mime_type: mime_type,
      file_path: file_path.replaceAll("{attachment_id}", attachment_id),
      uploaded_by: uploaded_by,
    } as schema.AttachmentTypeInsert)

    return attachment_id
  } catch (err) {
    throw handleError(err, "Exception for addAttachment", {
      principal_id,
      message_id,
      file_name,
      file_size,
      mime_type,
      file_path,
    })
  }
}

/**
 * Removes an attachment from its associated message. This is a soft-delete operation and the
 * data will stay in the database. You might want to delete these after a while for compliance
 * reasons.
 *
 * @param fdm The FDM instance providing the connection to the database. The instance can be created with
 * {@link createFdmServer} of fdm-core.
 * @param principal_id The principal identifier(s); must have write permission for the associated message.
 * @param attachment_id ID of the attachment to soft delete.
 * @returns true if the attachment was deleted now, and false if it was already deleted.
 * @throws if the attachment does not exist.
 */
export async function removeAttachment(
  fdm: FdmHelpdeskType,
  principal_id: HelpdeskPrincipalId,
  attachment_id: schema.AttachmentTypeSelect["attachment_id"],
): Promise<boolean> {
  try {
    const found = await fdm
      .select()
      .from(schema.attachments)
      .where(eq(schema.attachments.attachment_id, attachment_id))
      .limit(1)

    if (found.length === 0) {
      throw new Error(PERMISSION_ERROR_MESSAGE)
    }

    const attachment = found[0]

    await checkHelpdeskPermission(
      fdm,
      "message",
      "write",
      attachment.message_id,
      principal_id,
      "removeAttachment",
    )

    const deleteCount = (
      await fdm
        .update(schema.attachments)
        .set({ deleted_at: sql`now()` })
        .where(
          and(
            eq(schema.attachments.attachment_id, attachment_id),
            isNull(schema.attachments.deleted_at),
          ),
        )
        .returning({ attachment_id: schema.attachments.attachment_id })
    ).length

    return deleteCount > 0
  } catch (err) {
    throw handleError(err, "Exception for removeAttachment", { principal_id, attachment_id })
  }
}
