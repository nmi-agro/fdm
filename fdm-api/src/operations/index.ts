/**
 * The fdm-api operations layer.
 *
 * Each operation holds the input and output schemas, the rate-limit bucket and the logic of one
 * REST endpoint. The REST API and other services, such as the MCP server, run the same
 * operations, so validation, permissions, errors and payloads are identical across them.
 *
 * Run an operation with an {@link OperationContext}: the database, the services (usually
 * `defaultServices` from `@nmi-agro/fdm-api`) and the authenticated principal.
 *
 * @example
 * ```ts
 * import { defaultServices } from "@nmi-agro/fdm-api"
 * import { getFarm } from "@nmi-agro/fdm-api/operations"
 *
 * const farm = await getFarm.run({ fdm, services: defaultServices, principal }, { b_id_farm })
 * ```
 *
 * @packageDocumentation
 */
export * from "./types"
export * from "./common"
export * from "./farms"
export * from "./farm-groups"
export * from "./fields"
export * from "./cultivations"
export * from "./harvests"
export * from "./fertilizers"
export * from "./fertilizer-applications"
export * from "./soil-analyses"
export * from "./measures"
export * from "./organic-certifications"
export * from "./derogations"
export * from "./grazing-intentions"
export * from "./catalogues"
export * from "./calculations"
export * from "./indicators"
export * from "./aggregations"
