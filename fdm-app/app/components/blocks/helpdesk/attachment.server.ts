import { FdmType } from "@nmi-agro/fdm-core"
import { addAttachment, removeAttachment } from "@nmi-agro/fdm-helpdesk"
import { deleteObject, uploadObject } from "~/integrations/gcs.server"
import { handleActionError } from "~/lib/error"

type AttachmentFile = { name: string; buffer: Buffer; mime: string }

export function buildAttachmentObjectKey(attachment_id: string, _mime: string) {
  return `helpdesk_attachment/${attachment_id}`
}
/**
 * Attaches files to an helpdesk message in the name of a single principal. Most importantly,
 * this function uploads the files to Google Cloud Storage, and deletes any uploaded files if
 * any of the subsequent steps fail.
 *
 * GCS operations happen concurrently while database IO happens sequentally.
 *
 * @param fdm FDM server instance or transaction handle that provides the database connection.
 * @param principal_id ID of the principal who is creating the attachments.
 * @param message_id ID of the message to add the attachments to.
 * @param files Files that are parsed into a buffer object, and their name and MIME type.
 */
export async function attachFiles(
  fdm: FdmType,
  principal_id: string,
  message_id: string,
  files: AttachmentFile[],
) {
  const createdAttachments: string[] = []
  try {
    for (const { name, buffer, mime } of files) {
      createdAttachments.push(
        await addAttachment(
          fdm,
          principal_id,
          message_id,
          name,
          buffer.byteLength,
          mime,
          "helpdesk_attachment/dummy",
          principal_id,
        ),
      )
    }
    await Promise.all(
      files.map(async ({ buffer, mime }, i) => {
        const objectKey = buildAttachmentObjectKey(createdAttachments[i], mime)
        await uploadObject(objectKey, buffer, mime)
      }),
    )
    // for (let i = 0; i < files.length; i++) {
    //   const objectKey = buildAttachmentObjectKey(createdAttachments[i], files[i].mime)
    //   await updateAttachmentFilePath(fdm, principal_id, createdAttachments[i], objectKey)
    // }
  } catch (err) {
    const deleteObjectResults = await Promise.allSettled(
      files.map(async ({ mime }, i) => {
        const objectKey = buildAttachmentObjectKey(createdAttachments[i], mime)
        await deleteObject(objectKey)
      }),
    )
    for (const result of deleteObjectResults) {
      if (result.status === "rejected") {
        handleActionError(result.reason)
      }
    }
    for (const attachment_id of createdAttachments) {
      try {
        await removeAttachment(fdm, principal_id, attachment_id)
      } catch (removeError) {
        handleActionError(removeError)
      }
    }
    throw err
  }
}
