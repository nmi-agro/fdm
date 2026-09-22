import { FdmType } from "@nmi-agro/fdm-core"
import { addAttachment, removeAttachment } from "@nmi-agro/fdm-helpdesk"
import { uploadObject } from "~/integrations/gcs.server"
import { handleActionError } from "~/lib/error"
import { AttachmentGridItem } from "./attachment-grid"

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
): Promise<AttachmentGridItem[]> {
  const uploadPromises: Promise<AttachmentGridItem | null>[] = []
  for (const { name, buffer, mime } of files) {
    try {
      const attachment_id = await addAttachment(
        fdm,
        principal_id,
        message_id,
        name,
        buffer.byteLength,
        mime,
        buildAttachmentObjectKey("{attachment_id}", mime),
        principal_id,
      )

      const objectKey = buildAttachmentObjectKey(attachment_id, mime)
      const uploadPromise = uploadObject(objectKey, buffer, mime).then(
        () => {
          return {
            attachment_id: attachment_id,
            file_name: name,
            mime_type: mime,
            file_size: buffer.byteLength,
            file_path: objectKey,
          }
        },
        async (uploadError) => {
          try {
            await removeAttachment(fdm, principal_id, attachment_id)
          } catch (revertError) {
            handleActionError(revertError)
          }
          handleActionError(uploadError)
          return null
        },
      )
      uploadPromises.push(uploadPromise)
    } catch (createError) {
      handleActionError(new Error("Failed to create an attachment", { cause: createError }))
    }
  }

  return (await Promise.allSettled(uploadPromises))
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((x): x is AttachmentGridItem => !!x)
}
