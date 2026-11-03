import { createGcsStorage, type GcsStorage } from "@nmi-agro/fdm-storage"

export { buildObjectKey, FileNotFoundError, isGcsConfigured } from "@nmi-agro/fdm-storage"

/**
 * Shared Google Cloud Storage instance of the app. Bucket and credentials come from the
 * `GCS_BUCKET_NAME`, `GCS_SERVICE_ACCOUNT_EMAIL` and `GCS_SERVICE_ACCOUNT_KEY` environment
 * variables; see `@nmi-agro/fdm-storage` for the authentication order.
 */
export const gcsStorage: GcsStorage = createGcsStorage()

/**
 * Generates a V4 signed POST policy URL for a direct browser upload. Valid for 10 minutes.
 *
 * @param objectKey - The GCS object path
 * @param contentType - MIME type of the file being uploaded
 * @param maxSizeBytes - Maximum allowed file size in bytes (default 10MB)
 * @returns Signed upload URL
 */
export function generateSignedUploadUrl(
  objectKey: string,
  contentType: string,
  maxSizeBytes?: number,
): Promise<string> {
  return gcsStorage.generateSignedUploadUrl(objectKey, contentType, maxSizeBytes)
}

/**
 * Generates a V4 signed URL for reading (GET) a GCS object. Valid for 1 hour.
 *
 * @param objectKey - The GCS object path
 * @returns Signed read URL
 */
export function generateSignedReadUrl(objectKey: string): Promise<string> {
  return gcsStorage.signedReadUrl(objectKey)
}

/**
 * Generates a V4 signed URL for direct browser-to-GCS upload (PUT). Valid for 10 minutes.
 *
 * @param objectKey - The GCS object path
 * @param contentType - MIME type of the file being uploaded
 * @param maxSizeBytes - Maximum allowed file size in bytes (default 10MB)
 * @returns Object with the signed PUT URL and the object key
 */
export function generateSignedPutUrl(
  objectKey: string,
  contentType: string,
  maxSizeBytes?: number,
): Promise<{ uploadUrl: string; objectKey: string }> {
  return gcsStorage.generateSignedPutUrl(objectKey, contentType, maxSizeBytes)
}

/**
 * Checks whether a GCS object exists.
 *
 * @param objectKey - The GCS object path
 * @returns true if the object exists
 */
export function objectExists(objectKey: string): Promise<boolean> {
  return gcsStorage.exists(objectKey)
}

/**
 * Deletes an object from GCS. Deleting a missing object is not an error.
 *
 * @param objectKey - The GCS object path
 */
export function deleteObject(objectKey: string): Promise<void> {
  return gcsStorage.delete(objectKey)
}

/**
 * Uploads a Buffer directly to GCS.
 *
 * @param objectKey - The GCS object path
 * @param buffer - The file contents
 * @param contentType - MIME type of the file
 */
export function uploadObject(
  objectKey: string,
  buffer: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  return gcsStorage.upload(objectKey, buffer, contentType)
}

/**
 * Downloads a GCS object into memory, along with its content type. Used to proxy file
 * contents through the app server so downloads and inline views stay same-origin.
 * Transient network failures are retried once.
 *
 * @param objectKey - The GCS object path
 * @returns The object's contents plus its content type, when known
 * @throws {FileNotFoundError} When the object does not exist
 */
export function downloadObject(objectKey: string): Promise<{
  buffer: Buffer
  contentType?: string
}> {
  return gcsStorage.download(objectKey)
}
