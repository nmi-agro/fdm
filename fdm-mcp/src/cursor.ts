import { ApiError } from "@nmi-agro/fdm-api"

/** Number of items a list tool returns per page. */
export const PAGE_SIZE = 50

/**
 * Encodes a list offset as an opaque cursor. Clients pass the cursor back unchanged.
 *
 * @param offset - Index of the first item of the next page.
 * @returns The cursor.
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url")
}

/**
 * Decodes a cursor made by {@link encodeCursor}.
 *
 * @param cursor - The cursor, or `undefined` for the first page.
 * @returns The offset of the page.
 * @throws {ApiError} 400 `validation-failed` when the cursor is not valid.
 */
export function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined || cursor === "") return 0
  try {
    const { o } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o: unknown }
    if (typeof o === "number" && Number.isInteger(o) && o >= 0) return o
  } catch {
    // Fall through to the error below.
  }
  throw new ApiError(
    400,
    "validation-failed",
    "The cursor is not valid. Use `next_cursor` from the previous page, or omit `cursor` to start again.",
  )
}
