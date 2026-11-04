import type { FileStorage } from "@nmi-agro/fdm-storage"
import { ApiError } from "./error"

/**
 * Returns the configured file storage, or fails the request when none is available.
 *
 * @param getStorage - Service that resolves the storage.
 * @returns The file storage.
 * @throws {ApiError} 503 `service-unavailable` when no storage is configured.
 */
export function requireStorage(getStorage: () => FileStorage | undefined): FileStorage {
  const storage = getStorage()
  if (!storage) {
    throw new ApiError(503, "service-unavailable", "File storage is not configured on this server.")
  }
  return storage
}
