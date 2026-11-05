import { detectXml } from "@file-type/xml"
import { fileTypeFromBuffer } from "file-type"

/**
 * Thrown when an uploaded file is too large or its contents do not match an allowed type.
 */
export class InvalidUploadError extends Error {
  /** Why the upload was rejected. */
  readonly reason: "unsupported-type" | "too-large"

  /**
   * @param reason - Why the upload was rejected.
   * @param message - Description of the problem.
   */
  constructor(reason: "unsupported-type" | "too-large", message: string) {
    super(message)
    this.name = "InvalidUploadError"
    this.reason = reason
  }
}

/**
 * Options for {@link readAndValidateFileUpload}.
 */
export interface UploadValidationOptions {
  /** MIME types that are accepted. When omitted, any type is accepted. */
  allowedMimes?: ReadonlySet<string>
  /** Maximum file size in bytes. When omitted, the size is not checked. */
  maxBytes?: number
}

/**
 * Reads an uploaded file and detects its type from its contents (magic bytes).
 *
 * The file name and the declared content type are ignored, because a client controls both.
 *
 * @param file - The uploaded file.
 * @param options - Accepted types and maximum size.
 * @returns The file contents and the detected MIME type (`application/octet-stream` when unknown).
 * @throws {InvalidUploadError} When the file is too large or its type is not allowed.
 * @example
 * ```ts
 * const { buffer, mime } = await readAndValidateFileUpload(file, {
 *   allowedMimes: new Set(["image/jpeg", "image/png"]),
 *   maxBytes: 10 * 1024 * 1024,
 * })
 * ```
 */
export async function readAndValidateFileUpload(
  file: Blob,
  options: UploadValidationOptions = {},
): Promise<{ buffer: Buffer; mime: string }> {
  const { allowedMimes, maxBytes } = options
  if (maxBytes !== undefined && file.size > maxBytes) {
    throw new InvalidUploadError(
      "too-large",
      `File is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`,
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileType = await fileTypeFromBuffer(arrayBuffer, { customDetectors: [detectXml] })
  if (allowedMimes && (!fileType || !allowedMimes.has(fileType.mime))) {
    throw new InvalidUploadError(
      "unsupported-type",
      `Unsupported file type. Allowed: ${[...allowedMimes].join(", ")}`,
    )
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    mime: fileType?.mime ?? "application/octet-stream",
  }
}
