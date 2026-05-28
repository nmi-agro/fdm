import imageCompression from "browser-image-compression"

const COMPRESSION_OPTIONS = {
    maxSizeMB: 2,
    maxWidthOrHeight: 3840, // 4K max dimension
    useWebWorker: true,
    fileType: "image/jpeg",
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
 * Uploads an image to GCS via signed URL and confirms it in the database.
 *
 * @param file - The image File to upload
 * @param b_id_farm - The farm ID (used to scope the GCS object key)
 * @param a_id_visual - The visual soil analysis ID to attach the image to
 * @param options - Optional metadata (image_type, caption, sort_order)
 * @returns The created image record ID
 */
export async function uploadVisualSoilImage(
    file: File,
    b_id_farm: string,
    a_id_visual: string,
    options: {
        image_type?: string
        caption?: string
        sort_order?: number
    } = {},
): Promise<string> {
    // Step 1: Compress before upload
    const compressed = await compressImage(file)

    // Step 2: Request signed upload URL from our server
    const uploadResponse = await fetch("/api/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            b_id_farm,
            contentType: compressed.type || "image/jpeg",
        }),
    })

    if (!uploadResponse.ok) {
        const error = await uploadResponse.json().catch(() => ({}))
        throw new Error(
            `Failed to get upload URL: ${(error as { error?: string }).error ?? uploadResponse.statusText}`,
        )
    }

    const { uploadUrl, objectKey } = (await uploadResponse.json()) as {
        uploadUrl: string
        objectKey: string
    }

    // Step 3: PUT directly to GCS
    const gcsResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.type || "image/jpeg" },
        body: compressed,
    })

    if (!gcsResponse.ok) {
        throw new Error(`GCS upload failed: ${gcsResponse.status} ${gcsResponse.statusText}`)
    }

    // Step 4: Confirm the upload and register in database
    const confirmResponse = await fetch("/api/image-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            objectKey,
            a_id_visual,
            image_type: options.image_type,
            caption: options.caption,
            sort_order: options.sort_order ?? 0,
        }),
    })

    if (!confirmResponse.ok) {
        const error = await confirmResponse.json().catch(() => ({}))
        throw new Error(
            `Failed to confirm upload: ${(error as { error?: string }).error ?? confirmResponse.statusText}`,
        )
    }

    const { a_id_image } = (await confirmResponse.json()) as {
        a_id_image: string
    }
    return a_id_image
}
