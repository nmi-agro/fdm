import { OpenAPIHono } from "@hono/zod-openapi"
import { apiReference } from "@scalar/hono-api-reference"
import { cors } from "hono/cors"
import type { FdmAuth, FdmType } from "@nmi-agro/fdm-core"
import { createErrorHandler, createNotFoundHandler } from "./error"
import { requestGuard } from "./guards"
import { createApiKeyAuth } from "./auth"
import { registerCultivationRoutes } from "./routes/cultivations"
import { registerDerogationRoutes } from "./routes/derogations"
import { registerFarmRoutes } from "./routes/farms"
import { registerFertilizerApplicationRoutes } from "./routes/fertilizer-applications"
import { registerFertilizerRoutes } from "./routes/fertilizers"
import { registerFieldRoutes } from "./routes/fields"
import { registerGrazingIntentionRoutes } from "./routes/grazing-intentions"
import { registerHarvestRoutes } from "./routes/harvests"
import { registerMeasureRoutes } from "./routes/measures"
import { registerOrganicCertificationRoutes } from "./routes/organic-certifications"
import { registerSoilAnalysisRoutes } from "./routes/soil-analyses"
import type { FdmApiConfig, FdmApiServices } from "./index"
import type { ApiEnv } from "./types"

/**
 * Builds the OpenAPI-enabled Hono application that serves the FDM API.
 *
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param auth - Authentication service used to verify API keys on incoming requests.
 * @param config - Public API configuration, including display metadata and the base path.
 * @param services - Farm and field service implementations used by the registered routes.
 * @returns An `OpenAPIHono` application configured with middleware, routes, OpenAPI metadata, and the Scalar docs UI.
 * @example
 * ```ts
 * const app = buildApp(fdm, auth, config, services)
 * ```
 */
export function buildApp(
    fdm: FdmType,
    auth: FdmAuth,
    config: FdmApiConfig,
    services: FdmApiServices,
): OpenAPIHono<ApiEnv> {
    const { appName, appUrl, basePath = "/", allowedOrigins } = config
    const pathPrefix = basePath === "/" ? "" : basePath

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

    if (allowedOrigins && allowedOrigins.length > 0) {
        app.use(
            "*",
            cors({
                origin: allowedOrigins,
                allowMethods: [
                    "GET",
                    "POST",
                    "PUT",
                    "PATCH",
                    "DELETE",
                    "OPTIONS",
                ],
                allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
                exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
                maxAge: 86400,
            }),
        )
    }

    app.use("*", requestGuard)
    app.use(
        "*",
        createApiKeyAuth(auth, [
            `${pathPrefix}/docs`,
            `${pathPrefix}/openapi.json`,
            `${pathPrefix}/`,
        ]),
    )

    app.get("/", (c) => c.redirect(`${pathPrefix}/docs`, 302))

    registerFarmRoutes(app, fdm, services)
    registerFieldRoutes(app, fdm, services)
    registerCultivationRoutes(app, fdm, services)
    registerHarvestRoutes(app, fdm, services)
    registerFertilizerRoutes(app, fdm, services)
    registerFertilizerApplicationRoutes(app, fdm, services)
    registerMeasureRoutes(app, fdm, services)
    registerOrganicCertificationRoutes(app, fdm, services)
    registerDerogationRoutes(app, fdm, services)
    registerGrazingIntentionRoutes(app, fdm, services)
    registerSoilAnalysisRoutes(app, fdm, services)

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
            {
                name: "Cultivations",
                description: "Manage cultivations on fields",
            },
            {
                name: "Harvests",
                description: "Manage harvests on cultivations",
            },
            {
                name: "Fertilizers",
                description:
                    "Manage farm fertilizers and fertilizer catalogue entries",
            },
            {
                name: "Fertilizer Applications",
                description: "Manage fertilizer applications on fields",
            },
            { name: "Measures", description: "Manage measures on fields" },
            {
                name: "Organic Certifications",
                description: "Manage farm organic certifications",
            },
            { name: "Derogations", description: "Manage farm derogations" },
            {
                name: "Grazing Intentions",
                description: "Manage yearly grazing intentions for farms",
            },
            {
                name: "Soil Analyses",
                description: "Manage soil analyses on fields",
            },
            { name: "Calculations", description: "Run agronomic calculations" },
        ],
    })

    // Scalar UI
    app.get(
        "/docs",
        apiReference({
            pageTitle: `${appName} REST API`,
            spec: { url: `${pathPrefix}/openapi.json` },
            theme: "saturn",
            layout: "modern",
        }),
    )

    return app
}
