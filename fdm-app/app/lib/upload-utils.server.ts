import { detectXml } from "@file-type/xml"
import { fileTypeFromBuffer } from "file-type"
import { MAX_ATTACHMENT_SIZE } from "./upload-utils"

const UNSUPPORTED_FILE_TYPE_MESSAGE = "Unsupported file type."

// Rate limit for helpdesk file attachments. Max 20 files can be uploaded in any
// 10-minute window.
export const ATTACHMENT_UPLOAD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const ATTACHMENT_UPLOAD_RATE_LIMIT_MAX = 20

/**
 * Reads a file upload field, validates its MIME type against magic bytes,
 * and returns the raw buffer and detected MIME.
 * Throws if the type is not in allowedMimes.
 *
 * @param fileUpload - The uploaded file field
 * @param allowedMimes - Set of allowed MIME types (e.g. "image/jpeg", "image/png")
 * @returns Object containing the file buffer and detected MIME type.
 * @throws if the file is not a valid type.
 */
export async function readAndValidateFileUpload(
  file: File,
  allowedMimes?: Set<string>,
): Promise<{ buffer: Buffer; mime: string }> {
  const arrayBuffer = await file.arrayBuffer()
  const fileType = await fileTypeFromBuffer(arrayBuffer, { customDetectors: [detectXml] })
  if (allowedMimes && (!fileType || !allowedMimes.has(fileType.mime))) {
    throw new Error(`${UNSUPPORTED_FILE_TYPE_MESSAGE} Allowed: ${[...allowedMimes].join(", ")}`)
  }

  const fileBuffer = Buffer.from(arrayBuffer)
  const detectedMime = fileType?.mime ?? "application/octet-stream"

  return { buffer: fileBuffer, mime: detectedMime }
}

const MAX_PDF_SIZE = 5 * 1024 * 1024

/**
 * Reads a file upload field, validates that magic bytes confirm application/pdf.
 * Throws if the file is not a valid PDF or if the size is too big.
 *
 * @param fileUpload - The uploaded file field
 * @returns Object containing the file buffer.
 * @throws if the file is not a valid PDF.
 */
export async function readAndValidatePdfUpload(file: File): Promise<{ buffer: Buffer }> {
  if (file.size > MAX_PDF_SIZE) {
    throw new Error(`invalid: Bestand "${file.name}" is groter dan 5MB.`)
  }
  try {
    const { buffer } = await readAndValidateFileUpload(file, new Set(["application/pdf"]))
    return { buffer }
  } catch (error) {
    if (error instanceof Error && error.message.includes(UNSUPPORTED_FILE_TYPE_MESSAGE)) {
      throw new Error(`invalid: Bestand "${file.name}" is geen geldig PDF-bestand.`)
    }
    throw error
  }
}

/**
 * Reads a helpdesk attachment upload, validating its size and MIME type
 * (via magic bytes) against `allowedMimes`, and returns a friendly Dutch
 * error message on rejection instead of the raw internal error.
 *
 * @param file - The uploaded file field
 * @param allowedMimes - Set of allowed MIME types
 * @returns Object containing the file buffer and detected MIME type.
 * @throws with a Dutch, user-facing message if the file is too large or an unsupported type.
 */
export async function readAndValidateAttachmentUpload(
  file: File,
  allowedMimes: Set<string>,
): Promise<{ buffer: Buffer; mime: string }> {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(`Bestand "${file.name}" is groter dan 25MB.`)
  }
  try {
    return await readAndValidateFileUpload(file, allowedMimes)
  } catch (error) {
    if (error instanceof Error && error.message.includes(UNSUPPORTED_FILE_TYPE_MESSAGE)) {
      throw new Error(`Bestandstype van "${file.name}" wordt niet ondersteund.`)
    }
    throw error
  }
}
