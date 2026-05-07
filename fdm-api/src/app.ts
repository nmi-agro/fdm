import { OpenAPIHono } from "@hono/zod-openapi"
import { apiReference } from "@scalar/hono-api-reference"
import type { FdmAuth, FdmType } from "@nmi-agro/fdm-core"
import {
    getFarm,
    getFarms,
    getField,
    getFields,
} from "@nmi-agro/fdm-core"
import { createErrorHandler, createNotFoundHandler } from "./error"
import { requestGuard } from "./guards"
import { createApiKeyAuth } from "./auth"
import { registerFarmRoutes } from "./routes/farms"
import { registerFieldRoutes } from "./routes/fields"
import type { ApiEnv } from "./types"
import type { FdmApiConfig, FdmApiServices } from "./index"

export function buildApp(
    fdm: FdmType,
    auth: FdmAuth,
    config: FdmApiConfig,
    services: FdmApiServices,
): OpenAPIHono<ApiEnv> {
    const { appName, appUrl, basePath = "/api" } = config

    const app = new OpenAPIHono<ApiEnv>({
        defaultHook: (result, c) => {
            if (!result.success) {
                return c.json(
                    {
                        type: `${appUrl}/problems/validation-failed`,
                        title: "Validation Failed",
                        status: 400,
                        detail: "One or more fields failed validation.",
                        instance: c.req.path,
                        errors: result.error.issues,
                    },
                    400,
                    { "content-type": "application/problem+json" },
                )
            }
        },
    }).basePath(basePath)

    app.onError(createErrorHandler(appUrl))
    app.notFound(createNotFoundHandler(appUrl))

    app.use("*", requestGuard)
    app.use("*", createApiKeyAuth(auth, [`${basePath}/docs`, `${basePath}/openapi.json`]))

    registerFarmRoutes(app, fdm, services)
    registerFieldRoutes(app, fdm, services)

    // Security schemes
    app.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyHeader", {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "User-owned API key in the X-API-Key header.",
    })
    app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
        type: "http",
        scheme: "bearer",
        description: "User-owned API key as a Bearer token.",
    })

    // OpenAPI document
    app.doc("/openapi.json", {
        openapi: "3.1.0",
        info: {
            title: `${appName} REST API`,
            version: "0",
            description: `The ${appName} REST API provides programmatic access to farm data. Authentication requires a user-owned API key.`,
        },
        security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
        tags: [
            { name: "Farms", description: "Manage farms" },
            { name: "Fields", description: "Manage fields within farms" },
            { name: "Cultivations", description: "Manage cultivations on fields" },
            { name: "Soil Analyses", description: "Manage soil analyses on fields" },
            { name: "Calculations", description: "Run agronomic calculations" },
        ],
    })

    // Scalar UI
    app.get("/docs", apiReference({ spec: { url: `${basePath}/openapi.json` }, theme: "saturn" }))

    return app
}
