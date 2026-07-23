import type { FileUpload } from "@remix-run/form-data-parser"
import type { ActionFunctionArgs } from "react-router"
import { addSoilImage } from "@nmi-agro/fdm-core"
import { parseFormData } from "@remix-run/form-data-parser"
import { nanoid } from "nanoid"
import { buildObjectKey, uploadObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"
import { readAndValidateFileUpload } from "~/lib/upload-utils.server"

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * API Route: Upload a soil image directly to GCS and register it in the database.
 *
 * Flow:
 * 1. Browser POSTs multipart/form-data with the image file and metadata
 * 2. Server validates the file with magic-byte detection (file-type)
 * 3. Server calls addSoilImage which checks permissions, uploads to GCS via
 *    the onUpload callback, then inserts the DB record
 * 4. Returns the created image record ID
 */
export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let fileBuffer: Buffer | null = null
  let detectedMime: string | null = null

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName !== "file") return undefined
    const { buffer, mime } = await readAndValidateFileUpload(fileUpload, ALLOWED_MIME_TYPES)
    fileBuffer = buffer
    detectedMime = mime
    return new File([new Uint8Array(fileBuffer)], fileUpload.name, {
      type: detectedMime,
    })
  }

  let formData: FormData
  try {
    formData = await parseFormData(request, { maxFileSize: MAX_SIZE_BYTES }, uploadHandler)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid upload"
    return Response.json({ error: message }, { status: 400 })
  }

  if (!fileBuffer || !detectedMime) {
    return Response.json({ error: "No valid image file provided" }, { status: 400 })
  }

  const b_id_sampling_val = formData.get("b_id_sampling")
  const b_id_sampling = typeof b_id_sampling_val === "string" ? b_id_sampling_val : null
  if (!b_id_sampling) {
    return Response.json({ error: "b_id_sampling is required" }, { status: 400 })
  }

  const ext = MIME_TO_EXT[detectedMime] ?? "jpg"
  const objectKey = buildObjectKey("soil_image", nanoid(), ext)

  const ALLOWED_IMAGE_TYPES = new Set([
    "profile",
    "surface",
    "roots",
    "earthworms",
    "structure",
    "other",
  ])

  const rawImageTypeVal = formData.get("a_image_type")
  const rawImageType = typeof rawImageTypeVal === "string" ? rawImageTypeVal : undefined
  if (rawImageType !== undefined && !ALLOWED_IMAGE_TYPES.has(rawImageType)) {
    return Response.json(
      {
        error: `Invalid a_image_type. Allowed: ${[...ALLOWED_IMAGE_TYPES].join(", ")}`,
      },
      { status: 400 },
    )
  }
  const a_image_type = rawImageType as
    | "profile"
    | "surface"
    | "roots"
    | "earthworms"
    | "structure"
    | "other"
    | undefined

  const rawOrder = Number(formData.get("a_image_order") ?? 0)
  if (!Number.isFinite(rawOrder) || rawOrder < 0 || !Number.isInteger(rawOrder)) {
    return Response.json({ error: "a_image_order must be a non-negative integer" }, { status: 400 })
  }

  const capturedBuffer = fileBuffer
  const capturedMime = detectedMime

  try {
    const a_id_image = await addSoilImage(
      fdm,
      session.principal_id,
      b_id_sampling,
      {
        a_image_path: objectKey,
        a_image_type,
        a_image_caption:
          typeof formData.get("a_image_caption") === "string"
            ? (formData.get("a_image_caption") as string)
            : undefined,
        a_image_order: rawOrder,
      },
      async (path) => {
        await uploadObject(path, capturedBuffer, capturedMime)
      },
    )

    return Response.json({ success: true, a_id_image })
  } catch (err) {
    console.error("Failed to upload soil image", err)
    return Response.json({ error: "Failed to upload image" }, { status: 500 })
  }
}
