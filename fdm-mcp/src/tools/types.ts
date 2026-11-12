import type { ToolAnnotations } from "@modelcontextprotocol/server"
import type { FdmApiServices, RateBucket } from "@nmi-agro/fdm-api"
import type { Operation, OperationContext, OperationKind } from "@nmi-agro/fdm-api/operations"
import { z } from "zod"
import { decodeCursor, encodeCursor, PAGE_SIZE } from "../cursor"

/**
 * The services the MCP server runs operations with: all of fdm-api's services except report
 * branding, which only the fertilizer plans need and no tool uses.
 */
export type McpServices = Omit<FdmApiServices, "getReportBranding">

/** The context a tool runs in: the database, the services and the authenticated principal. */
export type ToolContext = OperationContext<McpServices>

// The services of an operation are a subset of FdmApiServices, so any operation runs with a
// ToolContext. The loose type lets one list hold operations of every resource.
// oxlint-disable-next-line typescript/no-explicit-any
type AnyOperation = Operation<z.ZodType, z.ZodType, any>

/**
 * An MCP tool, backed by one or more fdm-api operations.
 */
export interface McpTool {
  /** Tool name in snake_case, as the assistant sees it. */
  name: string
  /** Short human-readable title. */
  title: string
  /** Description for the model: what the tool does, units, date format and ids. */
  description: string
  /** What the tool does to data; determines the annotations. */
  kind: OperationKind
  /** Rate-limit bucket that a call counts in, shared with the REST API. */
  bucket: RateBucket
  /** Whether the tool calls an external service (the NMI API). */
  external: boolean
  /** The `operationId`s of the fdm-api operations the tool covers. */
  operations: readonly string[]
  /** Schema of the arguments. */
  input: z.ZodType
  /** Schema of the structured result; always an object. */
  output: z.ZodType
  /** Runs the tool with validated arguments and returns the structured result. */
  run: (ctx: ToolContext, args: unknown) => Promise<Record<string, unknown>>
}

/** Text that the tool descriptions share. */
export interface ToolMeta {
  /** Tool name in snake_case. */
  name: string
  /** Short human-readable title. */
  title: string
  /** Description for the model. */
  description: string
}

/**
 * Builds the MCP tool annotations from what a tool does. Clients use them to decide when to ask
 * the user for confirmation: reads run without a prompt, writes ask first, and updates and
 * deletes are marked destructive because they overwrite or remove stored data.
 *
 * @param tool - The tool.
 * @returns The annotations.
 */
export function annotationsFor(
  tool: Pick<McpTool, "title" | "kind" | "external">,
): ToolAnnotations {
  return {
    title: tool.title,
    readOnlyHint: tool.kind === "read",
    // Updates overwrite stored values, so the MCP specification counts them as destructive too.
    destructiveHint: tool.kind === "update" || tool.kind === "delete",
    idempotentHint: tool.kind === "read" || tool.kind === "update" || tool.kind === "delete",
    openWorldHint: tool.external,
  }
}

/**
 * Creates a tool that runs one operation whose result is an object.
 *
 * @param operation - The operation to run.
 * @param meta - Name, title and description of the tool.
 * @returns The tool.
 */
export function operationTool(operation: AnyOperation, meta: ToolMeta): McpTool {
  return {
    ...meta,
    kind: operation.kind,
    bucket: operation.bucket,
    external: operation.external ?? false,
    operations: [operation.name],
    input: operation.input,
    output: operation.output,
    run: async (ctx, args) => (await operation.run(ctx, args)) as Record<string, unknown>,
  }
}

/** Arguments that every list tool accepts for paging. */
const CursorShape = {
  cursor: z
    .string()
    .optional()
    .describe("Opaque cursor from `next_cursor` of the previous page. Omit it for the first page."),
}

/**
 * Adds fields to an object schema, also when the schema has refinements (which `extend` rejects).
 */
function withFields(schema: z.ZodType, shape: z.ZodRawShape): z.ZodType {
  if (schema instanceof z.ZodObject) {
    return schema.safeExtend(shape)
  }
  return z.intersection(schema, z.object(shape))
}

/**
 * Creates a tool that runs a list operation and returns its items in pages of {@link PAGE_SIZE},
 * with an opaque cursor for the next page.
 *
 * @param operation - A list operation; its output is an array.
 * @param meta - Name, title and description of the tool.
 * @returns The tool.
 */
export function listTool(operation: AnyOperation, meta: ToolMeta): McpTool {
  const itemsSchema = operation.output
  return {
    ...meta,
    kind: operation.kind,
    bucket: operation.bucket,
    external: operation.external ?? false,
    operations: [operation.name],
    input: withFields(operation.input, CursorShape),
    output: z.object({
      data: itemsSchema.describe("The items on this page."),
      next_cursor: z
        .string()
        .nullable()
        .describe("Pass this as `cursor` to get the next page. `null` on the last page."),
      total: z.number().int().describe("Total number of items over all pages."),
    }),
    run: async (ctx, args) => {
      const { cursor, ...input } = args as { cursor?: string } & Record<string, unknown>
      const offset = decodeCursor(cursor)
      const items = (await operation.run(ctx, input)) as unknown[]
      const next = offset + PAGE_SIZE
      return {
        data: items.slice(offset, next),
        next_cursor: next < items.length ? encodeCursor(next) : null,
        total: items.length,
      }
    },
  }
}
