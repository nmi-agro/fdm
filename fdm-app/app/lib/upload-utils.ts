export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]

export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

const MIME_TO_EXT = { ...IMAGE_MIME_TO_EXT }

export function getFileExtensionFromMime(mime: string): string | null {
  return mime in MIME_TO_EXT ? MIME_TO_EXT[mime] : null
}

/** Maximum size, in bytes, of a single helpdesk message/ticket attachment. */
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024

/** Maximum number of attachments that can be added to a single helpdesk message/ticket. */
export const MAX_ATTACHMENTS = 5

/**
 * MIME types accepted for helpdesk attachments: the allowed image types,
 * PDF, and common office/document formats, and shapefiles. Anything else is rejected by
 * `readAndValidateFileUpload` server-side.
 *
 * Archive file formats are included since it is highly likely that the user
 * tries to upload a zip file downloaded from the government systems.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set<string>([
  ...ALLOWED_IMAGE_MIME_TYPES,
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/xml",
  "image/svg+xml",
  "image/tiff",
  "image/tiff-fx",
  "image/vnd.dxf",
  "image/vnd.dwg",
  "application/text",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.shp",
  "application/vnd.shp.shx",
  "application/dbf",
  "application/dbase",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/gzip",
  "application/x-7z-compressed",
])

/**
 * File extensions (including the leading dot) accepted for helpdesk
 * attachments, used to configure the client-side `Dropzone`'s `accept`
 * prop. Kept in sync with `ALLOWED_ATTACHMENT_MIME_TYPES` for a consistent
 * client/server allow-list, though the server always validates the actual
 * file content via magic bytes rather than trusting the extension.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".svg",
  ".xml",
  ".dxf",
  ".dwg",
  ".pdf",
  ".txt",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".odt",
  ".ods",
  ".shp",
  ".shx",
  ".dbf",
  ".prj",
  ".zip",
  ".rar",
  ".gz",
  ".7z",
]

/**
 * Sanitizes a user-supplied attachment file name before it is stored or
 * displayed/downloaded. Strips path separators and control characters (to
 * avoid corrupting UI/`download=` attributes or database storage with
 * unexpected characters), collapses whitespace, and caps the length so an
 * excessively long name can't distort layouts or storage.
 */
export function sanitizeAttachmentFileName(name: string): string {
  const withoutPath = name.replace(/^.*[/\\]/, "")
  // eslint-disable-next-line no-control-regex -- Control character matching is explicitly required to sanitize attachment file names before storage/display.
  const withoutControlChars = withoutPath.replace(/[\x00-\x1f\x7f]/g, "")
  const collapsedWhitespace = withoutControlChars.replace(/\s+/g, " ").trim()
  const safeName = collapsedWhitespace.length > 0 ? collapsedWhitespace : "bestand"
  const MAX_FILENAME_LENGTH = 150
  if (safeName.length <= MAX_FILENAME_LENGTH) {
    return safeName
  }
  const extensionMatch = safeName.match(/\.[^.]+$/)
  const extension = extensionMatch ? extensionMatch[0] : ""
  if (extension.length >= MAX_FILENAME_LENGTH) {
    return safeName.slice(0, MAX_FILENAME_LENGTH)
  }
  const base = safeName.slice(0, MAX_FILENAME_LENGTH - extension.length)
  return `${base}${extension}`
}
