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
