import { OpenAPIHono } from "@hono/zod-openapi"
import { apiReference } from "@scalar/hono-api-reference"
import { errorHandler, notFoundHandler } from "~/lib/api/error"
import { apiKeyAuth } from "~/lib/api/auth"
import { requestGuard } from "~/lib/api/guards"
import type { ApiPrincipalContext } from "~/lib/api/auth"

type ApiEnv = {
    Variables: {
        principal: ApiPrincipalContext
    }
}
const { name: appName, url: appUrl } = serverConfig

const app = new OpenAPIHono<ApiEnv>({ defaultHook: (result, c) => {
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
} }).basePath("/api")

app.onError(errorHandler)
app.notFound(notFoundHandler)

app.use("*", requestGuard)
app.use("*", apiKeyAuth)

// OpenAPI security schemes
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

// Serve OpenAPI document
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
        {
            name: "Soil Analyses",
            description: "Manage soil analyses on fields",
        },
        {
            name: "Calculations",
            description: "Run agronomic calculations",
        },
    ],
})

// Serve Scalar API reference UI
app.get(
    "/docs",
    apiReference({
        spec: { url: "/api/openapi.json" },
        theme: "saturn",
    }),
)

export { app }
