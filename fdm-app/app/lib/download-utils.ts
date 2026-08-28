/**
 * Removes diacritics and any character that isn't alphanumeric, replacing
 * runs of them with a single underscore, so the result is safe to use as a
 * filename across Windows/macOS/Android/iOS file systems.
 */
export function sanitizeForFilename(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}
