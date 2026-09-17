export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

export function getFileExtensionFromMime(mime: string) {
  if (!(mime in MIME_TO_EXT)) {
    throw new Error(`Unrecognized MIME type: ${mime}`)
  }

  return MIME_TO_EXT[mime]
}
