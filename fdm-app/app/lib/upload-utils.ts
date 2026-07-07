import type { FileUpload } from "@remix-run/form-data-parser"
import { fileTypeFromBuffer } from "file-type"

/**
 * Reads a file upload field, validates its MIME type against magic bytes,
 * and returns the raw buffer and detected MIME.
 * Throws if the type is not in allowedMimes or exceeds maxSizeBytes.
 *
 * @param fileUpload - The uploaded file field
 * @param allowedMimes - Set of allowed MIME types (e.g. "image/jpeg", "image/png")
 * @returns Object containing the file buffer and detected MIME type.
 * @throws if the file is not a valid type.
 */
export async function readAndValidateFileUpload(
  fileUpload: FileUpload,
  allowedMimes: Set<string>,
): Promise<{ buffer: Buffer; mime: string }> {
  const arrayBuffer = await fileUpload.arrayBuffer()
  const fileType = await fileTypeFromBuffer(arrayBuffer)
  if (!fileType || !allowedMimes.has(fileType.mime)) {
    throw new Error(`Unsupported file type. Allowed: ${[...allowedMimes].join(", ")}`)
  }

  const fileBuffer = Buffer.from(arrayBuffer)
  const detectedMime = fileType.mime

  return { buffer: fileBuffer, mime: detectedMime }
}

/**
 * Reads a file upload field, validates that magic bytes confirm application/pdf.
 * Throws if the file is not a valid PDF.
 *
 * @param fileUpload - The uploaded file field
 * @returns Object containing the file buffer.
 * @throws if the file is not a valid PDF.
 */
export async function readAndValidatePdfUpload(
  fileUpload: FileUpload,
): Promise<{ buffer: Buffer }> {
  const { buffer } = await readAndValidateFileUpload(fileUpload, new Set(["application/pdf"]))
  return { buffer }
}
