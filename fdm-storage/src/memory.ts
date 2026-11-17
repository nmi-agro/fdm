import { FileNotFoundError, type FileStorage, type StoredFile } from "./types"

/**
 * Creates a {@link FileStorage} that keeps files in memory.
 *
 * Intended for tests and local development. Files are lost when the process ends.
 *
 * @returns A new, empty in-memory storage.
 * @example
 * ```ts
 * const storage = createMemoryStorage()
 * await storage.upload("soil_image/a.png", buffer, "image/png")
 * ```
 */
export function createMemoryStorage(): FileStorage & {
  /** Keys of all stored files, for assertions in tests. */
  keys(): string[]
} {
  const files = new Map<string, StoredFile>()

  return {
    async upload(objectKey, data, contentType) {
      files.set(objectKey, { buffer: Buffer.from(data), contentType })
    },
    async download(objectKey) {
      const file = files.get(objectKey)
      if (!file) throw new FileNotFoundError(objectKey)
      return { buffer: Buffer.from(file.buffer), contentType: file.contentType }
    },
    async delete(objectKey) {
      files.delete(objectKey)
    },
    async exists(objectKey) {
      return files.has(objectKey)
    },
    async move(fromKey, toKey) {
      const file = files.get(fromKey)
      if (!file) throw new FileNotFoundError(fromKey)
      files.set(toKey, file)
      files.delete(fromKey)
    },
    async signedReadUrl(objectKey) {
      if (!files.has(objectKey)) throw new FileNotFoundError(objectKey)
      return `memory://${objectKey}`
    },
    keys() {
      return [...files.keys()]
    },
  }
}
