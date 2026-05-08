/** @module */

import type { FdmAuth, FdmType } from "@nmi-agro/fdm-core"
import {
    getFarm,
    getFarms,
    getField,
    getFields,
} from "@nmi-agro/fdm-core"
import { buildApp } from "./app"

/**
 * Describes the public configuration used to mount the FDM API application.
 */
export interface FdmApiConfig {
    /** Human-readable application name exposed in the generated OpenAPI document. */
    appName: string
    /** Canonical application URL used to build absolute problem type links. */
    appUrl: string
    /**
     * Base path under which the API, OpenAPI document, and docs UI are served.
     * Defaults to `"/"` for standalone deployments (e.g. `api.yourdomain.com/docs`).
     * Set to `"/api"` when embedding in another app (e.g. `app.yourdomain.com/api/docs`).
     */
    basePath?: string
    /**
     * Allowed origins for CORS. When provided, CORS headers are added to all
     * responses. Omit when the API is served from the same origin as the app.
     */
    allowedOrigins?: string[]
}

/**
 * Defines the core data access functions used by the API routes.
 */
export interface FdmApiServices {
    /** Resolves the farms visible to a principal. */
    getFarms: typeof getFarms
    /** Resolves a single farm by identifier for a principal. */
    getFarm: typeof getFarm
    /** Resolves the fields that belong to a farm for a principal. */
    getFields: typeof getFields
    /** Resolves a single field by identifier for a principal. */
    getField: typeof getField
}

const defaultServices: FdmApiServices = { getFarms, getFarm, getFields, getField }

/**
 * Creates a fully configured Hono application for the FDM REST API.
 *
 * @param fdm - Database and service context from `@nmi-agro/fdm-core`.
 * @param auth - Authentication service used to verify incoming API keys.
 * @param config - Public API configuration such as names, URLs, and base path.
 * @param services - Optional service overrides for testing or custom data access behaviour.
 * @returns An `OpenAPIHono` application with middleware, routes, OpenAPI output, and docs UI registered.
 * @example
 * ```ts
 * const app = createFdmApi(fdm, auth, {
 *   appName: "My App",
 *   appUrl: "https://example.com",
 *   basePath: "/api",
 * })
 * ```
 */
export function createFdmApi(
    fdm: FdmType,
    auth: FdmAuth,
    config: FdmApiConfig,
    services: Partial<FdmApiServices> = {},
) {
    return buildApp(fdm, auth, config, { ...defaultServices, ...services })
}

export type { ApiPrincipalContext, ApiEnv } from "./types"
