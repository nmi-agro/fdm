import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { getFarm, getFarms } from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import {
    commonErrorResponses,
    paginatedResponse,
    paginatedSchema,
    PaginationQuerySchema,
} from "../schemas"

/**
 * Defines the farm data access functions required by the farm routes.
 */
export interface FarmServices {
    /** Returns all farms visible to the authenticated principal. */
    getFarms: typeof getFarms
    /** Returns a single farm visible to the authenticated principal. */
    getFarm: typeof getFarm
}

const FarmSchema = z.object({
    b_id_farm: z.string(),
    b_name_farm: z.string().nullable(),
    b_businessid_farm: z.string().nullable(),
    b_address_farm: z.string().nullable(),
    b_postalcode_farm: z.string().nullable(),
}).openapi("Farm")

const listFarmsRoute = createRoute({
    method: "get",
    path: "/farms",
    tags: ["Farms"],
    summary: "List all farms",
    description: "Returns all farms accessible by the authenticated API key.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { query: PaginationQuerySchema },
    responses: {
        200: {
            description: "A paginated list of farms.",
            content: { "application/json": { schema: paginatedSchema(FarmSchema) } },
        },
        ...commonErrorResponses,
    },
})

const getFarmRoute = createRoute({
    method: "get",
    path: "/farms/{b_id_farm}",
    tags: ["Farms"],
    summary: "Get a farm",
    description: "Returns a single farm by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_farm: z.string() }) },
    responses: {
        200: {
            description: "The requested farm.",
            content: { "application/json": { schema: FarmSchema } },
        },
        ...commonErrorResponses,
    },
})

/**
 * Registers the farm listing and detail routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Farm service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested farm cannot be found.
 * @example
 * ```ts
 * registerFarmRoutes(app, fdm, services)
 * ```
 */
export function registerFarmRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: FarmServices,
): void {
    app.use("/farms", rateLimitMiddleware(fdm, "general"))
    app.use("/farms/*", rateLimitMiddleware(fdm, "general"))

    const listFarmsHandler: RouteHandler<typeof listFarmsRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
        const farms = await services.getFarms(fdm, principal.effectivePrincipalId)
        const projected = farms.map((f) => ({
            b_id_farm: f.b_id_farm,
            b_name_farm: f.b_name_farm,
            b_businessid_farm: f.b_businessid_farm,
            b_address_farm: f.b_address_farm,
            b_postalcode_farm: f.b_postalcode_farm,
        }))
        return c.json(paginatedResponse(projected, limit, offset), 200)
    }

    const getFarmHandler: RouteHandler<typeof getFarmRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        const farm = await services.getFarm(fdm, principal.effectivePrincipalId, b_id_farm)
        if (!farm?.b_id_farm) {
            throw new ApiError(404, "not-found", `Farm '${b_id_farm}' not found.`)
        }
        return c.json({
            b_id_farm: farm.b_id_farm,
            b_name_farm: farm.b_name_farm,
            b_businessid_farm: farm.b_businessid_farm,
            b_address_farm: farm.b_address_farm,
            b_postalcode_farm: farm.b_postalcode_farm,
        }, 200)
    }

    app.openapi(listFarmsRoute, listFarmsHandler)
    app.openapi(getFarmRoute, getFarmHandler)
}
