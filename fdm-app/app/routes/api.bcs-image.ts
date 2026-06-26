import { checkPermission } from "@nmi-agro/fdm-core"
import type { FileUpload } from "@remix-run/form-data-parser"
import { parseFormData } from "@remix-run/form-data-parser"
import { fileTypeFromBuffer } from "file-type"
import { nanoid } from "nanoid"
import type { ActionFunctionArgs } from "react-router"
import { generateSignedReadUrl, uploadObject } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"

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

const MAX_SIZE_BYTES = 10 * 1024 * 1024

export async function action({ request }: ActionFunctionArgs) {
  const session = await getSession(request)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let fileBuffer: Buffer | null = null
  let detectedMime: string | null = null

  const uploadHandler = async (fileUpload: FileUpload) => {
    if (fileUpload.fieldName !== "file") return undefined

    const arrayBuffer = await fileUpload.arrayBuffer()
    const fileType = await fileTypeFromBuffer(arrayBuffer)
    if (!fileType || !ALLOWED_MIME_TYPES.has(fileType.mime)) {
      throw new Error(`Unsupported file type. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`)
    }

    fileBuffer = Buffer.from(arrayBuffer)
    detectedMime = fileType.mime
    return new File([new Uint8Array(arrayBuffer)], fileUpload.name, {
      type: detectedMime,
    })
  }

  let formData: FormData
  try {
    formData = await parseFormData(request, { maxFileSize: MAX_SIZE_BYTES }, uploadHandler)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid upload"
    return Response.json({ error: message }, { status: 400 })
  }

  if (!fileBuffer || !detectedMime) {
    return Response.json({ error: "No valid image file provided" }, { status: 400 })
  }

  const b_id = formData.get("b_id")?.toString()
  if (!b_id) {
    return Response.json({ error: "b_id is required" }, { status: 400 })
  }

  try {
    await checkPermission(
      fdm,
      "field",
      "write",
      b_id,
      session.principal_id,
      new URL(request.url).pathname,
    )
  } catch {
    return Response.json(
      {
        error: "You do not have permission to upload images for this field",
      },
      { status: 403 },
    )
  }

  const ext = MIME_TO_EXT[detectedMime] ?? "jpg"
  const objectKey = `soil_image/${nanoid()}.${ext}`

  try {
    await uploadObject(objectKey, fileBuffer, detectedMime)
    const url = await generateSignedReadUrl(objectKey)
    return Response.json({ objectKey, url })
  } catch (error) {
    console.error("Failed to upload BCS image", error)
    return Response.json({ error: "Failed to upload image" }, { status: 500 })
  }
}
