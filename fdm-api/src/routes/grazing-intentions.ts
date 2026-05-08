import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
    getGrazingIntentions,
    removeGrazingIntention,
    setGrazingIntention,
} from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { rateLimitMiddleware } from "../rate-limit"
import {
    commonErrorResponses,
    paginatedResponse,
    paginatedSchema,
    PaginationQuerySchema,
    writeErrorResponses,
} from "../schemas"
import type { ApiEnv, ApiPrincipalContext } from "../types"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the grazing intention data access functions required by the grazing intention routes. */
export interface GrazingIntentionServices {
    getGrazingIntentions: typeof getGrazingIntentions
    setGrazingIntention: typeof setGrazingIntention
    removeGrazingIntention: typeof removeGrazingIntention
}

const GrazingIntentionSchema = z
    .object({
        b_id_farm: z.string(),
        b_grazing_intention_year: z.number().int(),
        b_grazing_intention: z.boolean(),
    })
    .openapi("GrazingIntention")

const SetGrazingIntentionBodySchema = z
    .object({
        b_grazing_intention: z
            .boolean()
            .describe(
                "Whether the farm intends to graze in the specified year.",
            ),
    })
    .openapi("SetGrazingIntention")

const listGrazingIntentionsRoute = createRoute({
    method: "get",
    path: "/farms/{b_id_farm}/grazing-intentions",
    tags: ["Grazing Intentions"],
    summary: "List grazing intentions on a farm",
    description: "Returns all grazing intentions for the specified farm.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        query: PaginationQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of grazing intentions.",
            content: {
                "application/json": {
                    schema: paginatedSchema(GrazingIntentionSchema),
                },
            },
        },
        ...commonErrorResponses,
    },
})

const putGrazingIntentionRoute = createRoute({
    method: "put",
    path: "/farms/{b_id_farm}/grazing-intentions/{b_grazing_intention_year}",
    tags: ["Grazing Intentions"],
    summary: "Set a grazing intention",
    description:
        "Creates or updates a grazing intention for the specified farm and year.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({
            b_id_farm: z.string(),
            b_grazing_intention_year: z.coerce
                .number()
                .int()
                .openapi({ type: "integer", param: { required: true } }),
        }),
        body: {
            content: {
                "application/json": { schema: SetGrazingIntentionBodySchema },
            },
            required: true,
        },
    },
    responses: {
        200: {
            description: "Grazing intention set.",
            content: { "application/json": { schema: GrazingIntentionSchema } },
        },
        ...writeErrorResponses,
    },
})

const deleteGrazingIntentionRoute = createRoute({
    method: "delete",
    path: "/farms/{b_id_farm}/grazing-intentions/{b_grazing_intention_year}",
    tags: ["Grazing Intentions"],
    summary: "Delete a grazing intention",
    description: "Deletes a grazing intention for the specified farm and year.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({
            b_id_farm: z.string(),
            b_grazing_intention_year: z.coerce
                .number()
                .int()
                .openapi({ type: "integer", param: { required: true } }),
        }),
    },
    responses: {
        204:{ description: "Grazing intention deleted." },
        ...commonErrorResponses,
    },
})

/**
 * Registers the grazing intention routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Grazing intention service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerGrazingIntentionRoutes(app, fdm, services)
 * ```
 */
export function registerGrazingIntentionRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: GrazingIntentionServices,
): void {
    // /farms/*/grazing-intentions is covered by the /farms/* middleware in farms.ts
    const middleware = (
        c: Parameters<ReturnType<typeof rateLimitMiddleware>>[0],
        next: Parameters<ReturnType<typeof rateLimitMiddleware>>[1],
    ) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next)
    app.use("/farms/*/grazing-intentions", middleware)
    app.use("/farms/*/grazing-intentions/*", middleware)

    const listGrazingIntentionsHandler: RouteHandler<
        typeof listGrazingIntentionsRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<
            typeof PaginationQuerySchema
        >
        const intentions = await services.getGrazingIntentions(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        return c.json(paginatedResponse(intentions, limit, offset), 200)
    }

    const putGrazingIntentionHandler: RouteHandler<
        typeof putGrazingIntentionRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm, b_grazing_intention_year } = c.req.valid("param") as { b_id_farm: string; b_grazing_intention_year: number }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof SetGrazingIntentionBodySchema
        >
        await services.setGrazingIntention(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            b_grazing_intention_year,
            body.b_grazing_intention,
        )
        return c.json(
            {
                b_id_farm,
                b_grazing_intention_year,
                b_grazing_intention: body.b_grazing_intention,
            },
            200,
        )
    }

    const deleteGrazingIntentionHandler: RouteHandler<
        typeof deleteGrazingIntentionRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm, b_grazing_intention_year } = c.req.valid("param") as { b_id_farm: string; b_grazing_intention_year: number }
        await services.removeGrazingIntention(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            b_grazing_intention_year,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(listGrazingIntentionsRoute, listGrazingIntentionsHandler)
    app.openapi(putGrazingIntentionRoute, putGrazingIntentionHandler)
    app.openapi(deleteGrazingIntentionRoute, deleteGrazingIntentionHandler)
}
