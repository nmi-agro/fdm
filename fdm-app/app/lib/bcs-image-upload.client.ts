import { compressImage } from "~/lib/image-upload.client"

export interface BcsUploadResult {
    objectKey: string
    url: string
}

export async function uploadBcsImage(
    file: File,
    b_id: string,
    caption?: string,
): Promise<BcsUploadResult> {
    const compressed = await compressImage(file)
    const formData = new FormData()
    formData.append("file", compressed, compressed.name)
    formData.append("b_id", b_id)
    if (caption) {
        formData.append("caption", caption)
    }

    const response = await fetch("/api/bcs-image", {
        method: "POST",
        body: formData,
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(
            `Upload failed: ${(error as { error?: string }).error ?? response.statusText}`,
        )
    }

    return (await response.json()) as BcsUploadResult
}
