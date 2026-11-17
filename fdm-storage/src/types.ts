/**
 * Contents and content type of a downloaded file.
 */
export interface StoredFile {
  /** File contents. */
  buffer: Buffer
  /** MIME type recorded when the file was uploaded, when known. */
  contentType?: string
}

/**
 * Storage backend for files that FDM refers to by object key, such as soil analysis PDFs,
 * soil images and fertilizer plans.
 *
 * Object keys are paths within the storage backend, for example `soil_analysis/{a_id}.pdf`.
 * Build them with {@link buildObjectKey}.
 */
export interface FileStorage {
  /**
   * Stores a file under the given key, replacing any existing file with that key.
   *
   * @param objectKey - Key to store the file under.
   * @param data - File contents.
   * @param contentType - MIME type of the file.
   */
  upload(objectKey: string, data: Buffer | Uint8Array, contentType: string): Promise<void>

  /**
   * Reads a file into memory.
   *
   * @param objectKey - Key of the file.
   * @returns The file contents and content type.
   * @throws {FileNotFoundError} When no file exists with this key.
   */
  download(objectKey: string): Promise<StoredFile>

  /**
   * Deletes a file. Deleting a key that does not exist is not an error.
   *
   * @param objectKey - Key of the file.
   */
  delete(objectKey: string): Promise<void>

  /**
   * Checks whether a file exists.
   *
   * @param objectKey - Key of the file.
   * @returns `true` when the file exists.
   */
  exists(objectKey: string): Promise<boolean>

  /**
   * Moves a file to a new key.
   *
   * @param fromKey - Current key of the file.
   * @param toKey - New key of the file.
   * @throws {FileNotFoundError} When no file exists with `fromKey`.
   */
  move(fromKey: string, toKey: string): Promise<void>

  /**
   * Returns a time-limited URL to read the file directly from the storage backend.
   *
   * @param objectKey - Key of the file.
   * @returns A URL that is valid for one hour.
   */
  signedReadUrl(objectKey: string): Promise<string>
}

/**
 * Thrown when a file does not exist in the storage backend.
 */
export class FileNotFoundError extends Error {
  /** Key of the missing file. */
  readonly objectKey: string

  /**
   * @param objectKey - Key of the missing file.
   */
  constructor(objectKey: string) {
    super(`File not found: ${objectKey}`)
    this.name = "FileNotFoundError"
    this.objectKey = objectKey
  }
}

/**
 * Returns a consistently formatted object key.
 *
 * @param prefix - Folder of the object, for example `soil_analysis`.
 * @param id - Unique identifier of the object, for example the soil analysis ID.
 * @param ext - File extension without a leading dot, for example `pdf`.
 * @returns The object key, for example `soil_analysis/{a_id}.pdf`.
 * @example
 * ```ts
 * buildObjectKey("soil_analysis", a_id, "pdf") // "soil_analysis/<a_id>.pdf"
 * ```
 */
export function buildObjectKey(prefix: string, id: string, ext: string): string {
  return `${prefix}/${id}.${ext}`
}
