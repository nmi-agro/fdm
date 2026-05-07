import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono } from "@hono/zod-openapi"
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

export interface FarmServices {
    getFarms: typeof getFarms
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
    path: "/farms/{farmId}",
    tags: ["Farms"],
    summary: "Get a farm",
    description: "Returns a single farm by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ farmId: z.string() }) },
    responses: {
        200: {
            description: "The requested farm.",
            content: { "application/json": { schema: FarmSchema } },
        },
        ...commonErrorResponses,
    },
})

export function registerFarmRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: FarmServices,
): void {
    app.use("/farms", rateLimitMiddleware(fdm, "general"))
    app.use("/farms/*", rateLimitMiddleware(fdm, "general"))

    app.openapi(listFarmsRoute, async (c) => {
        const principal = c.get("principal") as ApiPrincipalContext
        const { limit, offset } = c.req.valid("query")
        const farms = await services.getFarms(fdm, principal.effectivePrincipalId)
        const projected = farms.map((f) => ({
            b_id_farm: f.b_id_farm,
            b_name_farm: f.b_name_farm,
            b_businessid_farm: f.b_businessid_farm,
            b_address_farm: f.b_address_farm,
            b_postalcode_farm: f.b_postalcode_farm,
        }))
        return c.json(paginatedResponse(projected, limit, offset), 200)
    })

    app.openapi(getFarmRoute, async (c) => {
        const principal = c.get("principal") as ApiPrincipalContext
        const { farmId } = c.req.valid("param")
        const farm = await services.getFarm(fdm, principal.effectivePrincipalId, farmId)
        if (!farm?.b_id_farm) {
            throw new ApiError(404, "not-found", `Farm '${farmId}' not found.`)
        }
        return c.json({
            b_id_farm: farm.b_id_farm,
            b_name_farm: farm.b_name_farm,
            b_businessid_farm: farm.b_businessid_farm,
            b_address_farm: farm.b_address_farm,
            b_postalcode_farm: farm.b_postalcode_farm,
        }, 200)
    })
}
