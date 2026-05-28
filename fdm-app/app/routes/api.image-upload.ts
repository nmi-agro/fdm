import { nanoid } from "nanoid"
import type { ActionFunctionArgs } from "react-router"
import { checkPermission } from "@nmi-agro/fdm-core"
import { generateSignedPutUrl } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"

const ALLOWED_CONTENT_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
] as const

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * API Route: Generate a V4 signed PUT URL for direct browser-to-GCS image upload.
 *
 * Flow:
 * 1. Browser POSTs {b_id_farm, contentType} to this route
 * 2. Server verifies the session and farm write permission
 * 3. Server generates a signed PUT URL scoped to a unique object key
 * 4. Browser PUTs the image directly to GCS using the signed URL
 * 5. Browser POSTs to /api/image-confirm to register the image in the DB
 */
export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request)
    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { b_id_farm?: string; contentType?: string }
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { b_id_farm, contentType } = body

    if (!b_id_farm) {
        return Response.json({ error: "b_id_farm is required" }, { status: 400 })
    }

    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_CONTENT_TYPES)[number])) {
        return Response.json(
            {
                error: `Unsupported content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
            },
            { status: 400 },
        )
    }

    const hasPermission = await checkPermission(
        fdm,
        "farm",
        "write",
        b_id_farm,
        session.principal_id,
        "api.image-upload",
        false,
    )

    if (!hasPermission) {
        return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const ext = contentType.split("/")[1].replace("jpeg", "jpg")
    const objectKey = `visual_soil_analysis/farms/${b_id_farm}/${nanoid()}.${ext}`

    try {
        const { uploadUrl } = await generateSignedPutUrl(
            objectKey,
            contentType,
            MAX_SIZE_BYTES,
        )

        return Response.json({ uploadUrl, objectKey })
    } catch (err) {
        console.error("Failed to generate signed upload URL", err)
        return Response.json(
            { error: "Failed to generate upload URL" },
            { status: 500 },
        )
    }
}
