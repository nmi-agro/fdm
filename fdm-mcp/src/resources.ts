import {
  type McpServer,
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  ResourceTemplate,
} from "@modelcontextprotocol/server"
import { classifyError } from "@nmi-agro/fdm-api"
import { getFarm, getField } from "@nmi-agro/fdm-api/operations"
import type { ToolContext } from "./tools/types"
import { LOG_OPTIONS } from "./log"

/** Results of resource reads may be cached briefly, only by the requesting client. */
const CACHE_HINT = { ttlMs: 30_000, cacheScope: "private" } as const

/**
 * Reads a record through an operation and returns it as a JSON resource. A missing record is
 * reported as "resource not found"; other failures as an internal error without details.
 */
async function readJson(
  uri: URL,
  read: () => Promise<unknown>,
): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  // The HTTP route counts resources/read in the general rate-limit bucket already.
  try {
    const record = await read()
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(record) }],
    }
  } catch (err) {
    const { status, detail } = classifyError(err, LOG_OPTIONS)
    if (status === 404 || status === 403) throw new ResourceNotFoundError(uri.href)
    throw new ProtocolError(ProtocolErrorCode.InternalError, detail)
  }
}

/**
 * Registers the read-only resource templates for clients that browse context: a farm
 * (`fdm://farms/{b_id_farm}`) and a field (`fdm://fields/{b_id_field}`). They run the same
 * operations as `get_farm` and `get_field`.
 *
 * @param server - The MCP server of the request.
 * @param ctx - Database, services and principal.
 */
export function registerResources(server: McpServer, ctx: ToolContext): void {
  server.registerResource(
    "farm",
    new ResourceTemplate("fdm://farms/{b_id_farm}", { list: undefined }),
    {
      title: "Farm",
      description: "A farm with its name, business id and address, as JSON.",
      mimeType: "application/json",
      cacheHint: CACHE_HINT,
    },
    async (uri, variables) =>
      readJson(uri, () => getFarm.run(ctx, { b_id_farm: String(variables.b_id_farm) })),
  )
  server.registerResource(
    "field",
    new ResourceTemplate("fdm://fields/{b_id_field}", { list: undefined }),
    {
      title: "Field",
      description:
        "A field with its name, area (ha), boundary as GeoJSON and start and end date (YYYY-MM-DD), as JSON.",
      mimeType: "application/json",
      cacheHint: CACHE_HINT,
    },
    async (uri, variables) =>
      readJson(uri, () => getField.run(ctx, { b_id: String(variables.b_id_field) })),
  )
}
