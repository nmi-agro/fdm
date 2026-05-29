import { fileTypeFromBuffer } from "file-type"
import type { ActionFunctionArgs } from "react-router"
import { addSoilImage } from "@nmi-agro/fdm-core"
import { objectExists } from "~/integrations/gcs.server"
import { getSession } from "~/lib/auth.server"
import { fdm } from "~/lib/fdm.server"

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
])

/**
 * API Route: Confirm a completed GCS image upload and register it in the database.
 *
 * After the browser uploads directly to GCS, it calls this route to:
 * 1. Verify the session
 * 2. Confirm the object exists in GCS
 * 3. Validate the MIME type matches expectations
 * 4. Save the image record linked to the soil sampling
 */
export async function action({ request }: ActionFunctionArgs) {
    const session = await getSession(request)
    if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: {
        objectKey?: string
        b_id_sampling?: string
        image_type?: string
        caption?: string
        sort_order?: number
    }
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { objectKey, b_id_sampling, image_type, caption, sort_order } = body

    if (!objectKey || !b_id_sampling) {
        return Response.json(
            { error: "objectKey and b_id_sampling are required" },
            { status: 400 },
        )
    }

    // Validate that the object path matches expected pattern (security check)
    if (!/^farms\/[^/]+\/visual-soil\/[^/]+\.(jpg|jpeg|png|webp|heic|heif)$/i.test(objectKey)) {
        return Response.json({ error: "Invalid object key format" }, { status: 400 })
    }

    // Confirm the file actually exists in GCS
    const exists = await objectExists(objectKey)
    if (!exists) {
        return Response.json(
            { error: "Object not found in GCS. Upload may have failed." },
            { status: 404 },
        )
    }

    // Note: Full magic-byte validation would require downloading the file from GCS.
    // For now we validate the file extension as a reasonable security check.
    // A background job can periodically validate and remove invalid files.
    const ext = objectKey.split(".").pop()?.toLowerCase()
    const extToMime: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        heic: "image/heic",
        heif: "image/heif",
    }
    const inferredMime = ext ? extToMime[ext] : undefined
    if (!inferredMime || !ALLOWED_MIME_TYPES.has(inferredMime)) {
        return Response.json(
            { error: "Unsupported file type" },
            { status: 400 },
        )
    }

    try {
        const a_id_image = await addSoilImage(
            fdm,
            session.principal_id,
            b_id_sampling,
            {
                a_image_path: objectKey,
                a_image_type: image_type as
                    | "profile"
                    | "surface"
                    | "roots"
                    | "earthworms"
                    | "structure"
                    | "other"
                    | undefined,
                a_image_caption: caption,
                a_image_order: sort_order ?? 0,
            },
        )

        return Response.json({ success: true, a_id_image })
    } catch (err) {
        console.error("Failed to save image record", err)
        return Response.json(
            { error: "Failed to save image record" },
            { status: 500 },
        )
    }
}
