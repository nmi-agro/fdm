import type { FdmType } from "@nmi-agro/fdm-core"
import type { Context } from "hono"
import type { OperationContext } from "../operations/types"
import type { ApiEnv, ApiPrincipalContext } from "../types"

/**
 * Builds the context to run an operation for the principal of the current REST request.
 *
 * @param c - Hono context of the authenticated request.
 * @param fdm - Database used by the services.
 * @param services - Data-access functions for the operation.
 * @returns The operation context.
 * @example
 * ```ts
 * const farm = await getFarm.run(operationContext(c, fdm, services), { b_id_farm })
 * ```
 */
export function operationContext<S>(
  c: Context<ApiEnv>,
  fdm: FdmType,
  services: S,
): OperationContext<S> {
  return { fdm, services, principal: c.get("principal") as ApiPrincipalContext }
}
