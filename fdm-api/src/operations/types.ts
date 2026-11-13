import type { z } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import type { RateBucket } from "../rate-limit"
import type { ApiPrincipalContext } from "../types"

/**
 * Everything an operation needs to run on behalf of an authenticated principal.
 *
 * @typeParam S - The services the operation calls. Each domain declares a narrow interface; the
 * full `FdmApiServices` object satisfies all of them.
 */
export interface OperationContext<S = unknown> {
  /** Database used by the services. Mutations that need atomicity start a transaction on it. */
  fdm: FdmType
  /** Data-access functions, injectable so tests run without a database. */
  services: S
  /** The authenticated principal; `effectivePrincipalId` is passed to every service call. */
  principal: ApiPrincipalContext
}

/**
 * What an operation does to data. Clients use it to decide whether to ask the user for
 * confirmation; the MCP server derives its tool annotations from it.
 *
 * - `read`: returns data and changes nothing.
 * - `create`: adds a new record.
 * - `update`: changes an existing record. Repeating the same update gives the same result.
 * - `delete`: removes a record permanently.
 */
export type OperationKind = "read" | "create" | "update" | "delete"

/**
 * A single API operation, shared by the REST handlers and the MCP tools.
 *
 * An operation holds the input and output schemas, the rate-limit bucket and the logic of one
 * endpoint: the service calls, the `ApiError`s for missing resources or invalid input, and the
 * serialisation of the result. Transport concerns stay in the caller: REST adds status codes,
 * headers and `limit`/`offset` pagination, and MCP adds cursors and tool results.
 *
 * @typeParam I - Zod schema of the input: path parameters, query parameters and body fields in one object.
 * @typeParam O - Zod schema of the output. List operations return the full array.
 * @typeParam S - The services the operation calls.
 */
export interface Operation<I extends z.ZodType, O extends z.ZodType, S = unknown> {
  /** Stable camelCase name, also used as the `operationId` of the REST route. */
  name: string
  /** What the operation does to data. */
  kind: OperationKind
  /** Rate-limit bucket that a call counts in. */
  bucket: RateBucket
  /** Whether the operation calls an external service (the NMI API). */
  external?: boolean
  /** Schema of the input object. */
  input: I
  /** Schema of the result. */
  output: O
  /**
   * Runs the operation. The input is expected to be validated against `input` already.
   *
   * @throws {ApiError} When a resource is missing or the input is not acceptable.
   */
  run: (ctx: OperationContext<S>, input: z.infer<I>) => Promise<z.infer<O>>
}

/**
 * Declares an operation with full type inference for its input, output and services.
 *
 * @param operation - The operation definition.
 * @returns The same definition, typed.
 * @example
 * ```ts
 * export const getFarm = defineOperation({
 *   name: "getFarm",
 *   kind: "read",
 *   bucket: "general",
 *   input: z.object({ b_id_farm: FarmIdSchema }),
 *   output: FarmSchema,
 *   run: async ({ fdm, services, principal }, { b_id_farm }) => { ... },
 * })
 * ```
 */
export function defineOperation<I extends z.ZodType, O extends z.ZodType, S>(
  operation: Operation<I, O, S>,
): Operation<I, O, S> {
  return operation
}
