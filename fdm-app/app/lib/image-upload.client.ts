import imageCompression from "browser-image-compression"
// Vite ?url import emits the file as a static asset and returns its public URL.
// This lets the Web Worker load the library from the same origin instead of
// falling back to cdn.jsdelivr.net (which is blocked by our CSP).
import compressionLibURL from "browser-image-compression/dist/browser-image-compression?url"

const COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 3840, // 4K max dimension
  useWebWorker: true,
  fileType: "image/jpeg",
  libURL: compressionLibURL,
}

/**
 * Compresses an image file client-side before upload.
 * Targets ~2MB from original 3–15MB smartphone photos.
 *
 * @param file - The original image File from the input or camera
 * @returns A compressed File (JPEG)
 */
export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, COMPRESSION_OPTIONS)
}

/**
 * Compresses an image and uploads it to the server, which validates the file
 * with magic-byte detection and stores it in GCS.
 *
 * @param file - The image File to upload
 * @param b_id_sampling - The soil sampling ID to attach the image to
 * @param options - Optional metadata (image_type, caption, sort_order)
 * @returns The created image record ID
 */
export async function uploadSoilImage(
  file: File,
  b_id_sampling: string,
  options: {
    a_image_type?: string
    a_image_caption?: string
    a_image_order?: number
  } = {},
): Promise<string> {
  // Compress before upload
  const compressed = await compressImage(file)

  const formData = new FormData()
  formData.append("file", compressed, compressed.name)
  formData.append("b_id_sampling", b_id_sampling)
  if (options.a_image_type) formData.append("a_image_type", options.a_image_type)
  if (options.a_image_caption) formData.append("a_image_caption", options.a_image_caption)
  formData.append("a_image_order", String(options.a_image_order ?? 0))

  const response = await fetch("/api/image-upload", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`Upload failed: ${(error as { error?: string }).error ?? response.statusText}`)
  }

  const { a_id_image } = (await response.json()) as { a_id_image: string }
  return a_id_image
}
