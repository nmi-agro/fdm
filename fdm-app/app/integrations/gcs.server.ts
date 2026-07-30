import type { Readable } from "node:stream"
import { SaveData, Storage } from "@google-cloud/storage"

let _storage: Storage | null = null

/**
 * Returns a GCS Storage client using the best available authentication method:
 *
 * 1. Application Default Credentials (ADC) — preferred.
 *    - On GCP (Cloud Run, GKE, GCE, App Engine): automatically uses the
 *      service account attached to the runtime. Zero configuration required.
 *    - Locally: run `gcloud auth application-default login`.
 *    - Any environment: set GOOGLE_APPLICATION_CREDENTIALS to the path of a
 *      Workload Identity Federation config file (avoids long-lived key files).
 *
 * 2. Inline service account key (fallback, not recommended).
 *    - Set GCS_SERVICE_ACCOUNT_KEY to a base64-encoded JSON key file.
 *    - Only use this when ADC is not available and WIF is not configured.
 *
 * For signed URL generation the attached / impersonated service account must
 * have the `roles/iam.serviceAccountTokenCreator` role so the library can
 * call the IAM signBlob API without a local private key.
 * Optionally set GCS_SERVICE_ACCOUNT_EMAIL to explicitly declare which service
 * account email to sign as (required when using Workload Identity Federation).
 */
function getStorage(): Storage {
  if (_storage) return _storage

  const keyBase64 = process.env.GCS_SERVICE_ACCOUNT_KEY
  const serviceAccountEmail = process.env.GCS_SERVICE_ACCOUNT_EMAIL

  if (keyBase64) {
    // Fallback: inline JSON key (base64-encoded). Not recommended for
    // production; prefer ADC or Workload Identity Federation instead.
    const credentials = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"))
    _storage = new Storage({ credentials })
  } else {
    // Preferred: ADC. The library calls IAM signBlob for signed URLs.
    // serviceAccountEmail is required for Workload Identity Federation
    // and optional when the metadata server can resolve it automatically.
    _storage = serviceAccountEmail ? new Storage({ email: serviceAccountEmail }) : new Storage()
  }

  return _storage
}

function getBucketName(): string {
  const bucket = process.env.GCS_BUCKET_NAME
  if (!bucket) {
    throw new Error("GCS_BUCKET_NAME environment variable is not set")
  }
  return bucket
}

/**
 * Returns a consistently formatted GCS object key.
 * Example: buildObjectKey("soil_analysis", a_id, "pdf") → "soil_analysis/{a_id}.pdf"
 *
 * @param prefix - The prefix or folder in GCS (e.g. "soil_analysis")
 * @param id - The unique identifier for the object (e.g. a_id)
 * @param ext - The file extension (e.g. "pdf", "jpg")
 * @returns The full GCS object key
 */
export function buildObjectKey(prefix: string, id: string, ext: string): string {
  return `${prefix}/${id}.${ext}`
}

/**
 * Generates a V4 signed URL for direct browser-to-GCS upload (PUT).
 * TTL is 10 minutes. Size is limited via X-Goog-Content-Length-Range header.
 *
 * @param objectKey - The GCS object path (e.g. visual_soil_analysis/farms/{b_id_farm}/{id}.jpg)
 * @param contentType - MIME type of the file being uploaded
 * @param maxSizeBytes - Maximum allowed file size in bytes (default 10MB)
 * @returns Signed upload URL
 */
export async function generateSignedUploadUrl(
  objectKey: string,
  contentType: string,
  maxSizeBytes = 10 * 1024 * 1024,
): Promise<string> {
  const storage = getStorage()
  const bucket = getBucketName()

  const [url] = await storage
    .bucket(bucket)
    .file(objectKey)
    .generateSignedPostPolicyV4({
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      conditions: [
        ["content-length-range", 1, maxSizeBytes],
        ["eq", "$Content-Type", contentType],
      ],
      fields: {
        "Content-Type": contentType,
      },
    })

  return url.url
}

/**
 * Generates a V4 signed URL for reading (GET) a GCS object.
 * TTL is 1 hour.
 *
 * @param objectKey - The GCS object path
 * @returns Signed read URL
 */
export async function generateSignedReadUrl(objectKey: string): Promise<string> {
  const storage = getStorage()
  const bucket = getBucketName()

  const [url] = await storage
    .bucket(bucket)
    .file(objectKey)
    .getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })

  return url
}

/**
 * Generates a V4 signed URL for direct browser-to-GCS upload (PUT).
 *
 * @param objectKey - The GCS object path
 * @param contentType - MIME type of the file being uploaded
 * @param maxSizeBytes - Maximum allowed file size in bytes (default 10MB)
 * @returns Object with the signed PUT URL and the object key
 */
export async function generateSignedPutUrl(
  objectKey: string,
  contentType: string,
  maxSizeBytes = 10 * 1024 * 1024,
): Promise<{ uploadUrl: string; objectKey: string }> {
  const storage = getStorage()
  const bucket = getBucketName()

  const [uploadUrl] = await storage
    .bucket(bucket)
    .file(objectKey)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      contentType,
      extensionHeaders: {
        "X-Goog-Content-Length-Range": `0,${maxSizeBytes}`,
      },
    })

  return { uploadUrl, objectKey }
}

/**
 * Checks whether a GCS object exists.
 *
 * @param objectKey - The GCS object path
 * @returns true if the object exists
 */
export async function objectExists(objectKey: string): Promise<boolean> {
  const storage = getStorage()
  const bucket = getBucketName()

  const [exists] = await storage.bucket(bucket).file(objectKey).exists()
  return exists
}

/**
 * Deletes an object from GCS.
 *
 * @param objectKey - The GCS object path
 */
export async function deleteObject(objectKey: string): Promise<void> {
  const storage = getStorage()
  const bucket = getBucketName()

  await storage.bucket(bucket).file(objectKey).delete({ ignoreNotFound: true })
}

/**
 * Uploads a Buffer directly to GCS.
 *
 * @param objectKey - The GCS object path
 * @param buffer - The file contents
 * @param contentType - MIME type of the file
 */
export async function uploadObject(
  objectKey: string,
  buffer: SaveData,
  contentType: string,
): Promise<void> {
  const storage = getStorage()
  const bucket = getBucketName()

  await storage.bucket(bucket).file(objectKey).save(buffer, {
    contentType,
    resumable: false,
  })
}

/**
 * Opens a readable stream for a GCS object, along with its content type and
 * size (when known). Used to proxy file contents through the app server
 * instead of redirecting the client to a signed GCS URL, so downloads and
 * inline views stay same-origin.
 *
 * @param objectKey - The GCS object path
 * @returns The object's readable stream plus content type / size metadata
 */
export async function getObjectStream(objectKey: string): Promise<{
  stream: Readable
  contentType?: string
  size?: number
}> {
  const storage = getStorage()
  const bucket = getBucketName()
  const file = storage.bucket(bucket).file(objectKey)

  const [metadata] = await file.getMetadata()

  return {
    stream: file.createReadStream(),
    contentType: metadata.contentType ?? undefined,
    size: metadata.size !== undefined ? Number(metadata.size) : undefined,
  }
}
