import { ApiError, Storage } from "@google-cloud/storage"
import { FileNotFoundError, type FileStorage } from "./types"

/**
 * Configuration for {@link createGcsStorage}.
 */
export interface GcsStorageOptions {
  /** Bucket that holds the files. Defaults to the `GCS_BUCKET_NAME` environment variable. */
  bucketName?: string
  /**
   * Service account to sign URLs as. Defaults to `GCS_SERVICE_ACCOUNT_EMAIL`. Required with
   * Workload Identity Federation, optional when the metadata server can resolve it.
   */
  serviceAccountEmail?: string
  /**
   * Base64-encoded JSON service account key. Defaults to `GCS_SERVICE_ACCOUNT_KEY`.
   * Only use this when Application Default Credentials are not available.
   */
  serviceAccountKey?: string
}

/**
 * A {@link FileStorage} on Google Cloud Storage, with extra methods for direct browser uploads.
 */
export interface GcsStorage extends FileStorage {
  /**
   * Generates a V4 signed POST policy URL for a direct browser upload. Valid for 10 minutes.
   *
   * @param objectKey - Key to upload the file to.
   * @param contentType - Required MIME type of the upload.
   * @param maxSizeBytes - Maximum file size in bytes. Defaults to 10 MB.
   * @returns The signed upload URL.
   */
  generateSignedUploadUrl(
    objectKey: string,
    contentType: string,
    maxSizeBytes?: number,
  ): Promise<string>

  /**
   * Generates a V4 signed PUT URL for a direct browser upload. Valid for 10 minutes.
   *
   * @param objectKey - Key to upload the file to.
   * @param contentType - Required MIME type of the upload.
   * @param maxSizeBytes - Maximum file size in bytes. Defaults to 10 MB.
   * @returns The signed PUT URL and the object key.
   */
  generateSignedPutUrl(
    objectKey: string,
    contentType: string,
    maxSizeBytes?: number,
  ): Promise<{ uploadUrl: string; objectKey: string }>
}

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const TRANSIENT_NETWORK_ERROR_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNABORTED"])

/**
 * Checks whether Google Cloud Storage is configured.
 *
 * @param bucketName - Bucket name to check. Defaults to the `GCS_BUCKET_NAME` environment variable.
 * @returns `true` when a bucket name is set.
 */
export function isGcsConfigured(bucketName = process.env.GCS_BUCKET_NAME): boolean {
  return Boolean(bucketName?.trim())
}

/**
 * Returns true for transient network failures (for example a reused keep-alive socket that the
 * server already closed), which are worth retrying. HTTP errors from GCS are never transient.
 */
function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof ApiError || !(error instanceof Error)) return false
  const code = (error as NodeJS.ErrnoException).code
  if (code && TRANSIENT_NETWORK_ERROR_CODES.has(code)) return true
  return /socket hang up/i.test(error.message)
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 404
}

/**
 * Creates a {@link FileStorage} on Google Cloud Storage.
 *
 * Authentication uses Application Default Credentials (ADC) when available: on Google Cloud the
 * attached service account, locally `gcloud auth application-default login`, or a Workload
 * Identity Federation config through `GOOGLE_APPLICATION_CREDENTIALS`. An inline service account
 * key is a fallback only.
 *
 * Signed URLs require the service account to have `roles/iam.serviceAccountTokenCreator`.
 *
 * The client is created on first use, so creating the storage never fails; a missing bucket
 * name is reported when the first operation runs.
 *
 * @param options - Bucket and credentials. Missing values are read from the environment.
 * @returns A storage backed by the configured bucket.
 * @example
 * ```ts
 * const storage = createGcsStorage()
 * await storage.upload("soil_analysis/abc.pdf", buffer, "application/pdf")
 * ```
 */
export function createGcsStorage(options: GcsStorageOptions = {}): GcsStorage {
  let client: Storage | null = null

  function getClient(): Storage {
    if (client) return client
    const keyBase64 = options.serviceAccountKey ?? process.env.GCS_SERVICE_ACCOUNT_KEY
    const email = options.serviceAccountEmail ?? process.env.GCS_SERVICE_ACCOUNT_EMAIL
    if (keyBase64) {
      const credentials = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"))
      client = new Storage({ credentials })
    } else {
      client = email ? new Storage({ email }) : new Storage()
    }
    return client
  }

  function file(objectKey: string) {
    const bucket = options.bucketName ?? process.env.GCS_BUCKET_NAME
    if (!bucket?.trim()) {
      throw new Error("GCS_BUCKET_NAME environment variable is not set")
    }
    return getClient().bucket(bucket).file(objectKey)
  }

  return {
    async upload(objectKey, data, contentType) {
      await file(objectKey).save(Buffer.from(data), { contentType, resumable: false })
    },

    async download(objectKey) {
      const target = file(objectKey)
      const attempt = async () => {
        const [[metadata], [buffer]] = await Promise.all([target.getMetadata(), target.download()])
        return { buffer, contentType: metadata.contentType ?? undefined }
      }
      try {
        try {
          return await attempt()
        } catch (error) {
          if (!isTransientNetworkError(error)) throw error
          return await attempt()
        }
      } catch (error) {
        if (isNotFoundError(error)) throw new FileNotFoundError(objectKey)
        throw error
      }
    },

    async delete(objectKey) {
      await file(objectKey).delete({ ignoreNotFound: true })
    },

    async exists(objectKey) {
      const [exists] = await file(objectKey).exists()
      return exists
    },

    async move(fromKey, toKey) {
      try {
        await file(fromKey).move(toKey)
      } catch (error) {
        if (isNotFoundError(error)) throw new FileNotFoundError(fromKey)
        throw error
      }
    },

    async signedReadUrl(objectKey) {
      const [url] = await file(objectKey).getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      })
      return url
    },

    async generateSignedUploadUrl(objectKey, contentType, maxSizeBytes = DEFAULT_MAX_UPLOAD_BYTES) {
      const [policy] = await file(objectKey).generateSignedPostPolicyV4({
        expires: Date.now() + 10 * 60 * 1000,
        conditions: [
          ["content-length-range", 1, maxSizeBytes],
          ["eq", "$Content-Type", contentType],
        ],
        fields: { "Content-Type": contentType },
      })
      return policy.url
    },

    async generateSignedPutUrl(objectKey, contentType, maxSizeBytes = DEFAULT_MAX_UPLOAD_BYTES) {
      const [uploadUrl] = await file(objectKey).getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 10 * 60 * 1000,
        contentType,
        extensionHeaders: { "X-Goog-Content-Length-Range": `0,${maxSizeBytes}` },
      })
      return { uploadUrl, objectKey }
    },
  }
}
