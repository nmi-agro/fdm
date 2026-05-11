import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
    addHarvest,
    getHarvest,
    getHarvests,
    removeHarvest,
    updateHarvest,
} from "@nmi-agro/fdm-core"
import type { Harvest } from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import {
    commonErrorResponses,
    DateStringSchema,
    paginatedResponse,
    paginatedSchema,
    PaginationTimeframeQuerySchema,
    parseTimeframeQuery,
    serializeDate,
    writeErrorResponses,
} from "../schemas"
import type { ApiEnv, ApiPrincipalContext } from "../types"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the harvest data access functions required by the harvest routes. */
export interface HarvestServices {
    getHarvests: typeof getHarvests
    getHarvest: typeof getHarvest
    addHarvest: typeof addHarvest
    updateHarvest: typeof updateHarvest
    removeHarvest: typeof removeHarvest
}

const HarvestPropertyShape = {
    b_lu_yield: z.number().nullable().optional(),
    b_lu_yield_bruto: z.number().nullable().optional(),
    b_lu_yield_fresh: z.number().nullable().optional(),
    b_lu_tarra: z.number().nullable().optional(),
    b_lu_dm: z.number().nullable().optional(),
    b_lu_moist: z.number().nullable().optional(),
    b_lu_uww: z.number().nullable().optional(),
    b_lu_cp: z.number().nullable().optional(),
    b_lu_n_harvestable: z.number().nullable().optional(),
    b_lu_n_residue: z.number().nullable().optional(),
    b_lu_p_harvestable: z.number().nullable().optional(),
    b_lu_p_residue: z.number().nullable().optional(),
    b_lu_k_harvestable: z.number().nullable().optional(),
    b_lu_k_residue: z.number().nullable().optional(),
} as const

const HarvestableAnalysisSchema = z.object({
    b_id_harvestable_analysis: z.string(),
    b_lu_yield: z.number().nullable(),
    b_lu_yield_fresh: z.number().nullable(),
    b_lu_yield_bruto: z.number().nullable(),
    b_lu_tarra: z.number().nullable(),
    b_lu_dm: z.number().nullable(),
    b_lu_moist: z.number().nullable(),
    b_lu_uww: z.number().nullable(),
    b_lu_cp: z.number().nullable(),
    b_lu_n_harvestable: z.number().nullable(),
    b_lu_n_residue: z.number().nullable(),
    b_lu_p_harvestable: z.number().nullable(),
    b_lu_p_residue: z.number().nullable(),
    b_lu_k_harvestable: z.number().nullable(),
    b_lu_k_residue: z.number().nullable(),
})

const HarvestSchema = z
    .object({
        b_id_harvesting: z.string(),
        b_lu_harvest_date: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
        b_lu: z.string(),
        harvestable: z.object({
            b_id_harvestable: z.string(),
            harvestable_analyses: z.array(HarvestableAnalysisSchema),
        }),
    })
    .openapi("Harvest")

const CreateHarvestBodySchema = z
    .object({
        b_lu_harvest_date: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
        ...HarvestPropertyShape,
    })
    .openapi("CreateHarvest")

const UpdateHarvestBodySchema = z
    .object({
        b_lu_harvest_date: DateStringSchema
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        ...HarvestPropertyShape,
    })
    .openapi("UpdateHarvest")

const listHarvestsRoute = createRoute({
    method: "get",
    path: "/cultivations/{b_lu}/harvests",
    tags: ["Harvests"],
    summary: "List harvests on a cultivation",
    description: "Returns all harvests for the specified cultivation.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_lu: z.string() }),
        query: PaginationTimeframeQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of harvests.",
            content: {
                "application/json": { schema: paginatedSchema(HarvestSchema) },
            },
        },
        ...commonErrorResponses,
    },
})

const createHarvestRoute = createRoute({
    method: "post",
    path: "/cultivations/{b_lu}/harvests",
    tags: ["Harvests"],
    summary: "Create a harvest",
    description: "Creates a new harvest on the specified cultivation.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_lu: z.string() }),
        body: {
            content: {
                "application/json": { schema: CreateHarvestBodySchema },
            },
            required: true,
        },
    },
    responses: {
        201: {
            description: "Harvest created.",
            content: { "application/json": { schema: HarvestSchema } },
        },
        ...writeErrorResponses,
    },
})

const getHarvestRoute = createRoute({
    method: "get",
    path: "/harvests/{b_id_harvesting}",
    tags: ["Harvests"],
    summary: "Get a harvest",
    description: "Returns a single harvest by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_harvesting: z.string() }) },
    responses: {
        200: {
            description: "The requested harvest.",
            content: { "application/json": { schema: HarvestSchema } },
        },
        ...commonErrorResponses,
    },
})

const updateHarvestRoute = createRoute({
    method: "patch",
    path: "/harvests/{b_id_harvesting}",
    tags: ["Harvests"],
    summary: "Update a harvest",
    description: "Updates an existing harvest.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_harvesting: z.string() }),
        body: {
            content: {
                "application/json": { schema: UpdateHarvestBodySchema },
            },
            required: true,
        },
    },
    responses: {
        200: {
            description: "Harvest updated.",
            content: { "application/json": { schema: HarvestSchema } },
        },
        ...writeErrorResponses,
    },
})

const deleteHarvestRoute = createRoute({
    method: "delete",
    path: "/harvests/{b_id_harvesting}",
    tags: ["Harvests"],
    summary: "Delete a harvest",
    description: "Permanently deletes a harvest.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_harvesting: z.string() }) },
    responses: {
        204: { description: "Harvest deleted." },
        ...commonErrorResponses,
    },
})

function serialiseHarvest(harvest: Harvest) {
    return {
        b_id_harvesting: harvest.b_id_harvesting,
        b_lu_harvest_date: serializeDate(harvest.b_lu_harvest_date),
        b_lu: harvest.b_lu,
        harvestable: {
            b_id_harvestable: harvest.harvestable.b_id_harvestable,
            harvestable_analyses: harvest.harvestable.harvestable_analyses.map(
                (analysis) => ({
                    b_id_harvestable_analysis:
                        analysis.b_id_harvestable_analysis,
                    b_lu_yield: analysis.b_lu_yield ?? null,
                    b_lu_yield_fresh: analysis.b_lu_yield_fresh ?? null,
                    b_lu_yield_bruto: analysis.b_lu_yield_bruto ?? null,
                    b_lu_tarra: analysis.b_lu_tarra ?? null,
                    b_lu_dm: analysis.b_lu_dm ?? null,
                    b_lu_moist: analysis.b_lu_moist ?? null,
                    b_lu_uww: analysis.b_lu_uww ?? null,
                    b_lu_cp: analysis.b_lu_cp ?? null,
                    b_lu_n_harvestable: analysis.b_lu_n_harvestable ?? null,
                    b_lu_n_residue: analysis.b_lu_n_residue ?? null,
                    b_lu_p_harvestable: analysis.b_lu_p_harvestable ?? null,
                    b_lu_p_residue: analysis.b_lu_p_residue ?? null,
                    b_lu_k_harvestable: analysis.b_lu_k_harvestable ?? null,
                    b_lu_k_residue: analysis.b_lu_k_residue ?? null,
                }),
            ),
        },
    }
}

function getHarvestProperties(
    body:
        | z.infer<typeof CreateHarvestBodySchema>
        | z.infer<typeof UpdateHarvestBodySchema>,
) {
    const properties = {
        b_lu_yield: body.b_lu_yield,
        b_lu_yield_bruto: body.b_lu_yield_bruto,
        b_lu_yield_fresh: body.b_lu_yield_fresh,
        b_lu_tarra: body.b_lu_tarra,
        b_lu_dm: body.b_lu_dm,
        b_lu_moist: body.b_lu_moist,
        b_lu_uww: body.b_lu_uww,
        b_lu_cp: body.b_lu_cp,
        b_lu_n_harvestable: body.b_lu_n_harvestable,
        b_lu_n_residue: body.b_lu_n_residue,
        b_lu_p_harvestable: body.b_lu_p_harvestable,
        b_lu_p_residue: body.b_lu_p_residue,
        b_lu_k_harvestable: body.b_lu_k_harvestable,
        b_lu_k_residue: body.b_lu_k_residue,
    }
    return Object.values(properties).some((value) => value !== undefined)
        ? properties
        : undefined
}

/**
 * Registers the harvest CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Harvest service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested harvest cannot be found.
 * @example
 * ```ts
 * registerHarvestRoutes(app, fdm, services)
 * ```
 */
export function registerHarvestRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: HarvestServices,
): void {
    // /cultivations/*/harvests is covered by the /cultivations/* middleware in cultivations.ts
    app.use("/harvests", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )
    app.use("/harvests/*", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listHarvestsHandler: RouteHandler<typeof listHarvestsRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_lu } = c.req.valid("param") as { b_lu: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const query = c.req.valid("query") as z.infer<
            typeof PaginationTimeframeQuerySchema
        >
        const harvests = await services.getHarvests(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
            parseTimeframeQuery(query),
        )
        return c.json(
            paginatedResponse(
                harvests.map(serialiseHarvest),
                query.limit,
                query.offset,
            ),
            200,
        )
    }

    const createHarvestHandler: RouteHandler<
        typeof createHarvestRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_lu } = c.req.valid("param") as { b_lu: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof CreateHarvestBodySchema
        >
        const b_id_harvesting = await services.addHarvest(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
            new Date(body.b_lu_harvest_date),
            getHarvestProperties(body),
        )
        const harvest = await services.getHarvest(
            fdm,
            principal.effectivePrincipalId,
            b_id_harvesting,
        )
        if (!harvest?.b_id_harvesting) {
            throw new ApiError(
                500,
                "internal-error",
                "Harvest created but could not be retrieved.",
            )
        }
        c.header(
            "Location",
            `${new URL(c.req.url).origin}/harvests/${b_id_harvesting}`,
        )
        return c.json(serialiseHarvest(harvest), 201)
    }

    const getHarvestHandler: RouteHandler<typeof getHarvestRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_harvesting } = c.req.valid("param") as {
            b_id_harvesting: string
        }
        const harvest = await services.getHarvest(
            fdm,
            principal.effectivePrincipalId,
            b_id_harvesting,
        )
        if (!harvest?.b_id_harvesting) {
            throw new ApiError(
                404,
                "not-found",
                `Harvest '${b_id_harvesting}' not found.`,
            )
        }
        return c.json(serialiseHarvest(harvest), 200)
    }

    const updateHarvestHandler: RouteHandler<
        typeof updateHarvestRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_harvesting } = c.req.valid("param") as {
            b_id_harvesting: string
        }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof UpdateHarvestBodySchema
        >
        if (Object.values(body).every((value) => value === undefined)) {
            throw new ApiError(
                400,
                "validation-failed",
                "At least one field must be provided.",
            )
        }
        if (body.b_lu_harvest_date === undefined) {
            throw new ApiError(
                400,
                "validation-failed",
                "b_lu_harvest_date is required.",
            )
        }
        await services.updateHarvest(
            fdm,
            principal.effectivePrincipalId,
            b_id_harvesting,
            new Date(body.b_lu_harvest_date),
            getHarvestProperties(body),
        )
        const harvest = await services.getHarvest(
            fdm,
            principal.effectivePrincipalId,
            b_id_harvesting,
        )
        if (!harvest?.b_id_harvesting) {
            throw new ApiError(
                404,
                "not-found",
                `Harvest '${b_id_harvesting}' not found.`,
            )
        }
        return c.json(serialiseHarvest(harvest), 200)
    }

    const deleteHarvestHandler: RouteHandler<
        typeof deleteHarvestRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_harvesting } = c.req.valid("param") as {
            b_id_harvesting: string
        }
        await services.removeHarvest(
            fdm,
            principal.effectivePrincipalId,
            b_id_harvesting,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(listHarvestsRoute, listHarvestsHandler)
    app.openapi(createHarvestRoute, createHarvestHandler)
    app.openapi(getHarvestRoute, getHarvestHandler)
    app.openapi(updateHarvestRoute, updateHarvestHandler)
    app.openapi(deleteHarvestRoute, deleteHarvestHandler)
}
