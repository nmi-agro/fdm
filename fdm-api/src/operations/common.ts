import { z } from "@hono/zod-openapi"

/**
 * Result of a delete operation. REST answers `204 No Content` instead; MCP tools return this
 * object so the client gets a structured confirmation.
 */
export const DeletedSchema = z
  .object({
    deleted: z
      .literal(true)
      .describe("Always `true`: the record and the records that depend on it are deleted."),
  })
  .openapi("Deleted")

/** The value every delete operation returns. */
export const DELETED = { deleted: true } as const
