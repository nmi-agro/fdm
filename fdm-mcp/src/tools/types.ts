import type { ToolAnnotations } from "@modelcontextprotocol/server"
import type { FdmApiServices, RateBucket } from "@nmi-agro/fdm-api"
import type { Operation, OperationContext, OperationKind } from "@nmi-agro/fdm-api/operations"
import { ApiError } from "@nmi-agro/fdm-api"
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

/**
 * One way to run a scoped tool: the operation to use when the arguments name this scope.
 */
export interface ToolVariant {
  /** Name of the scope, for example `"field"` or `"farm"`. Returned as `scope` by {@link scopedTool}. */
  scope: string
  /** The operation to run. */
  operation: AnyOperation
  /**
   * The argument that selects this variant, for example `"b_id"`. Variants are tried in order;
   * the first whose key is present (or whose `when` returns true) is used.
   */
  key?: string
  /** Custom selection, used instead of `key`. */
  when?: (args: Record<string, unknown>) => boolean
}

/** Extra arguments of a scoped tool that are not part of any operation input. */
type ExtraShape = z.ZodRawShape

/** Returns the object shape of an operation input. */
function shapeOf(schema: z.ZodType): z.ZodRawShape {
  if (schema instanceof z.ZodObject) return schema.shape
  throw new Error("A scoped tool needs operations whose input is an object schema.")
}

/**
 * Merges the inputs of the variants into one argument schema in which every field is optional:
 * which fields are needed depends on the scope, and each variant validates its own input.
 */
function mergedInput(variants: ToolVariant[], extra: ExtraShape): z.ZodObject {
  const shape: Record<string, z.ZodType> = {}
  for (const variant of variants) {
    for (const [name, field] of Object.entries(shapeOf(variant.operation.input))) {
      if (shape[name]) continue
      const description = (field as z.ZodType).description
      const optional = (field as z.ZodType).optional()
      shape[name] = description ? optional.describe(description) : optional
    }
  }
  return z.object({ ...shape, ...extra })
}

/** Picks the variant for the arguments. */
function selectVariant(variants: ToolVariant[], args: Record<string, unknown>): ToolVariant {
  const variant = variants.find((candidate) =>
    candidate.when
      ? candidate.when(args)
      : candidate.key !== undefined && args[candidate.key] !== undefined,
  )
  if (!variant) {
    const keys = variants.map((candidate) => candidate.key).filter(Boolean)
    throw new ApiError(
      400,
      "validation-failed",
      `Give one of ${keys.map((key) => `\`${key}\``).join(", ")} to choose what this tool works on.`,
    )
  }
  return variant
}

/** Validates the arguments against the input of the chosen operation. */
function parseVariantInput(variant: ToolVariant, args: Record<string, unknown>): unknown {
  const shape = shapeOf(variant.operation.input)
  const picked = Object.fromEntries(Object.entries(args).filter(([name]) => name in shape))
  const parsed = variant.operation.input.safeParse(picked)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ")
    throw new ApiError(
      400,
      "validation-failed",
      `Invalid arguments for ${variant.scope}: ${problems}`,
    )
  }
  return parsed.data
}

/** The kind, bucket and openness of a scoped tool, taken from its variants. */
function combined(variants: ToolVariant[]) {
  const kinds = new Set(variants.map((variant) => variant.operation.kind))
  if (kinds.size !== 1) {
    throw new Error("All variants of a scoped tool must have the same kind.")
  }
  return {
    kind: variants[0].operation.kind,
    // The most restrictive bucket of the variants: a scoped tool counts as its heaviest variant.
    bucket: (["nmi", "calc", "write", "general"] as const).find((bucket) =>
      variants.some((variant) => variant.operation.bucket === bucket),
    ) as RateBucket,
    external: variants.some((variant) => variant.operation.external ?? false),
    operations: variants.map((variant) => variant.operation.name),
  }
}

/**
 * Creates a tool that runs one of several operations, chosen by a scope argument, and returns
 * `{ scope, result }`. For example `calculate_nitrogen_balance` for a field (`b_id`) or a farm
 * (`b_id_farm`). One tool instead of one per scope keeps the tool list short.
 *
 * @param meta - Name, title and description; the description must say which argument selects which scope.
 * @param variants - The scopes, in the order they are tried.
 * @param extra - Arguments that only `when` selectors use.
 * @returns The tool.
 */
export function scopedTool(
  meta: ToolMeta,
  variants: ToolVariant[],
  extra: ExtraShape = {},
): McpTool {
  const outputs = variants.map((variant) => variant.operation.output)
  return {
    ...meta,
    ...combined(variants),
    input: mergedInput(variants, extra),
    output: z.object({
      scope: z
        .enum(variants.map((variant) => variant.scope) as [string, ...string[]])
        .describe("What the result covers."),
      result: (outputs.length === 1
        ? outputs[0]
        : z.union(outputs as [z.ZodType, z.ZodType, ...z.ZodType[]])
      ).describe("The result for the chosen scope."),
    }),
    run: async (ctx, args) => {
      const values = args as Record<string, unknown>
      const variant = selectVariant(variants, values)
      const result = await variant.operation.run(ctx, parseVariantInput(variant, values))
      return { scope: variant.scope, result }
    },
  }
}

/**
 * Creates a list tool that runs one of several list operations, chosen by a scope argument, and
 * returns the items in pages like {@link listTool}. For example `list_cultivations` for a field
 * (`b_id`) or a farm (`b_id_farm`).
 *
 * @param meta - Name, title and description; the description must say which argument selects which scope.
 * @param variants - The scopes, in the order they are tried; their outputs are arrays.
 * @param extra - Arguments that only `when` selectors use.
 * @returns The tool.
 */
export function scopedListTool(
  meta: ToolMeta,
  variants: ToolVariant[],
  extra: ExtraShape = {},
): McpTool {
  const items = variants.map((variant) => {
    const output = variant.operation.output
    if (!(output instanceof z.ZodArray)) {
      throw new Error(`List variant ${variant.operation.name} does not return an array.`)
    }
    return output.element as z.ZodType
  })
  const itemSchema =
    items.length === 1 ? items[0] : z.union(items as [z.ZodType, z.ZodType, ...z.ZodType[]])
  return {
    ...meta,
    ...combined(variants),
    input: mergedInput(variants, { ...extra, ...CursorShape }),
    output: z.object({
      data: z.array(itemSchema).describe("The items on this page."),
      next_cursor: z
        .string()
        .nullable()
        .describe("Pass this as `cursor` to get the next page. `null` on the last page."),
      total: z.number().int().describe("Total number of items over all pages."),
    }),
    run: async (ctx, args) => {
      const { cursor, ...values } = args as { cursor?: string } & Record<string, unknown>
      const offset = decodeCursor(cursor)
      const variant = selectVariant(variants, values)
      const all = (await variant.operation.run(
        ctx,
        parseVariantInput(variant, values),
      )) as unknown[]
      const next = offset + PAGE_SIZE
      return {
        data: all.slice(offset, next),
        next_cursor: next < all.length ? encodeCursor(next) : null,
        total: all.length,
      }
    },
  }
}
