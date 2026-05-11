import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
    addCultivation,
    getCultivation,
    getCultivations,
    getCultivationsForFarm,
    removeCultivation,
    updateCultivation,
} from "@nmi-agro/fdm-core"
import type { Cultivation } from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import {
    commonErrorResponses,
    DateStringSchema,
    paginatedResponse,
    paginatedSchema,
    PaginationQuerySchema,
    serializeDate,
    writeErrorResponses,
} from "../schemas"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/**
 * Defines the cultivation data access functions required by the cultivation routes.
 */
export interface CultivationServices {
    /** Returns all cultivations on a field visible to the authenticated principal. */
    getCultivations: typeof getCultivations
    /** Returns all cultivations on a farm visible to the authenticated principal. */
    getCultivationsForFarm: typeof getCultivationsForFarm
    /** Returns a single cultivation visible to the authenticated principal. */
    getCultivation: typeof getCultivation
    /** Creates a new cultivation on an existing field. */
    addCultivation: typeof addCultivation
    /** Updates an existing cultivation. */
    updateCultivation: typeof updateCultivation
    /** Permanently deletes a cultivation. */
    removeCultivation: typeof removeCultivation
}

const CultivationSchema = z
    .object({
        b_lu: z.string(),
        b_lu_catalogue: z.string(),
        b_lu_source: z.string(),
        b_lu_name: z.string(),
        b_lu_name_en: z.string().nullable(),
        b_lu_hcat3: z.string().nullable(),
        b_lu_hcat3_name: z.string().nullable(),
        b_lu_croprotation: z.boolean().nullable(),
        b_lu_eom: z.number().nullable(),
        b_lu_eom_residue: z.number().nullable(),
        b_lu_harvestcat: z.string().nullable(),
        b_lu_harvestable: z.boolean(),
        b_lu_variety: z.string().nullable(),
        b_lu_start: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
        b_lu_end: DateStringSchema
            .nullable()
            .describe("Date in YYYY-MM-DD format."),
        m_cropresidue: z.boolean().nullable(),
        b_id: z.string(),
    })
    .openapi("Cultivation")

const CreateCultivationBodySchema = z
    .object({
        b_lu_catalogue: z
            .string()
            .describe("Cultivation catalogue identifier."),
        b_lu_start: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
        b_lu_end: DateStringSchema
            .nullable()
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        m_cropresidue: z
            .boolean()
            .nullable()
            .optional()
            .describe(
                "Whether crop residues remain in the field after harvest.",
            ),
        b_lu_variety: z
            .string()
            .nullable()
            .optional()
            .describe("Cultivation variety identifier."),
    })
    .openapi("CreateCultivation")

const UpdateCultivationBodySchema = z
    .object({
        b_lu_catalogue: z
            .string()
            .optional()
            .describe("Cultivation catalogue identifier."),
        b_lu_start: DateStringSchema
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        b_lu_end: DateStringSchema
            .nullable()
            .optional()
            .describe("Date in YYYY-MM-DD format."),
        m_cropresidue: z
            .boolean()
            .nullable()
            .optional()
            .describe(
                "Whether crop residues remain in the field after harvest.",
            ),
        b_lu_variety: z
            .string()
            .nullable()
            .optional()
            .describe("Cultivation variety identifier."),
    })
    .openapi("UpdateCultivation")

const listCultivationsRoute = createRoute({
    method: "get",
    path: "/fields/{b_id}/cultivations",
    tags: ["Cultivations"],
    summary: "List cultivations on a field",
    description: "Returns all cultivations on the specified field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        query: PaginationQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of cultivations.",
            content: {
                "application/json": {
                    schema: paginatedSchema(CultivationSchema),
                },
            },
        },
        ...commonErrorResponses,
    },
})

const listFarmCultivationsRoute = createRoute({
    method: "get",
    path: "/farms/{b_id_farm}/cultivations",
    tags: ["Cultivations"],
    summary: "List cultivations on a farm",
    description:
        "Returns all cultivations on all fields for the specified farm.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        query: PaginationQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of cultivations.",
            content: {
                "application/json": {
                    schema: paginatedSchema(CultivationSchema),
                },
            },
        },
        ...commonErrorResponses,
    },
})

const createCultivationRoute = createRoute({
    method: "post",
    path: "/fields/{b_id}/cultivations",
    tags: ["Cultivations"],
    summary: "Create a cultivation",
    description: "Creates a new cultivation on the specified field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        body: {
            content: {
                "application/json": { schema: CreateCultivationBodySchema },
            },
            required: true,
        },
    },
    responses: {
        201: {
            description: "Cultivation created.",
            content: { "application/json": { schema: CultivationSchema } },
        },
        ...writeErrorResponses,
    },
})

const getCultivationRoute = createRoute({
    method: "get",
    path: "/cultivations/{b_lu}",
    tags: ["Cultivations"],
    summary: "Get a cultivation",
    description: "Returns a single cultivation by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_lu: z.string() }) },
    responses: {
        200: {
            description: "The requested cultivation.",
            content: { "application/json": { schema: CultivationSchema } },
        },
        ...commonErrorResponses,
    },
})

const updateCultivationRoute = createRoute({
    method: "patch",
    path: "/cultivations/{b_lu}",
    tags: ["Cultivations"],
    summary: "Update a cultivation",
    description: "Partially updates an existing cultivation.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_lu: z.string() }),
        body: {
            content: {
                "application/json": { schema: UpdateCultivationBodySchema },
            },
            required: true,
        },
    },
    responses: {
        200: {
            description: "Cultivation updated.",
            content: { "application/json": { schema: CultivationSchema } },
        },
        ...writeErrorResponses,
    },
})

const deleteCultivationRoute = createRoute({
    method: "delete",
    path: "/cultivations/{b_lu}",
    tags: ["Cultivations"],
    summary: "Delete a cultivation",
    description: "Permanently deletes a cultivation.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_lu: z.string() }) },
    responses: {
        204: { description: "Cultivation deleted." },
        ...commonErrorResponses,
    },
})

function serialiseCultivation(cultivation: Cultivation) {
    return {
        b_lu: cultivation.b_lu,
        b_lu_catalogue: cultivation.b_lu_catalogue,
        b_lu_source: cultivation.b_lu_source,
        b_lu_name: cultivation.b_lu_name,
        b_lu_name_en: cultivation.b_lu_name_en ?? null,
        b_lu_hcat3: cultivation.b_lu_hcat3 ?? null,
        b_lu_hcat3_name: cultivation.b_lu_hcat3_name ?? null,
        b_lu_croprotation: cultivation.b_lu_croprotation ?? null,
        b_lu_eom: cultivation.b_lu_eom ?? null,
        b_lu_eom_residue: cultivation.b_lu_eom_residue ?? null,
        b_lu_harvestcat: cultivation.b_lu_harvestcat ?? null,
        b_lu_harvestable: cultivation.b_lu_harvestable,
        b_lu_variety: cultivation.b_lu_variety ?? null,
        b_lu_start: serializeDate(cultivation.b_lu_start),
        b_lu_end: serializeDate(cultivation.b_lu_end),
        m_cropresidue: cultivation.m_cropresidue ?? null,
        b_id: cultivation.b_id,
    }
}

/**
 * Registers the cultivation CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Cultivation service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerCultivationRoutes(app, fdm, services)
 * ```
 */
export function registerCultivationRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: CultivationServices,
): void {
    // /fields/*/cultivations is covered by the /fields/* middleware in fields.ts
    // /farms/*/cultivations is covered by the /farms/* middleware in farms.ts
    app.use("/cultivations", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )
    app.use("/cultivations/*", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listCultivationsHandler: RouteHandler<
        typeof listCultivationsRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<
            typeof PaginationQuerySchema
        >
        const cultivations = await services.getCultivations(
            fdm,
            principal.effectivePrincipalId,
            b_id,
        )
        return c.json(
            paginatedResponse(
                cultivations.map(serialiseCultivation),
                limit,
                offset,
            ),
            200,
        )
    }

    const listFarmCultivationsHandler: RouteHandler<
        typeof listFarmCultivationsRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<
            typeof PaginationQuerySchema
        >
        const cultivationsByField = await services.getCultivationsForFarm(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        const cultivations = Array.from(cultivationsByField.values()).flat()
        return c.json(
            paginatedResponse(
                cultivations.map(serialiseCultivation),
                limit,
                offset,
            ),
            200,
        )
    }

    const createCultivationHandler: RouteHandler<
        typeof createCultivationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof CreateCultivationBodySchema
        >
        const b_lu = await services.addCultivation(
            fdm,
            principal.effectivePrincipalId,
            body.b_lu_catalogue,
            b_id,
            new Date(body.b_lu_start),
            body.b_lu_end ? new Date(body.b_lu_end) : undefined,
            body.m_cropresidue ?? undefined,
            body.b_lu_variety ?? undefined,
        )
        const cultivation = await services.getCultivation(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
        )
        if (!cultivation?.b_lu) {
            throw new ApiError(
                500,
                "internal-error",
                "Cultivation created but could not be retrieved.",
            )
        }
        c.header(
            "Location",
            `${new URL(c.req.url).origin}/cultivations/${b_lu}`,
        )
        return c.json(serialiseCultivation(cultivation), 201)
    }

    const getCultivationHandler: RouteHandler<
        typeof getCultivationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_lu } = c.req.valid("param") as { b_lu: string }
        const cultivation = await services.getCultivation(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
        )
        if (!cultivation?.b_lu) {
            throw new ApiError(
                404,
                "not-found",
                `Cultivation '${b_lu}' not found.`,
            )
        }
        return c.json(serialiseCultivation(cultivation), 200)
    }

    const updateCultivationHandler: RouteHandler<
        typeof updateCultivationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_lu } = c.req.valid("param") as { b_lu: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof UpdateCultivationBodySchema
        >
        if (Object.values(body).every((value) => value === undefined)) {
            throw new ApiError(
                400,
                "validation-failed",
                "At least one field must be provided.",
            )
        }
        await services.updateCultivation(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
            body.b_lu_catalogue,
            body.b_lu_start ? new Date(body.b_lu_start) : undefined,
            body.b_lu_end === undefined
                ? undefined
                : body.b_lu_end
                  ? new Date(body.b_lu_end)
                  : null,
            body.m_cropresidue,
            body.b_lu_variety,
        )
        const cultivation = await services.getCultivation(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
        )
        if (!cultivation?.b_lu) {
            throw new ApiError(
                404,
                "not-found",
                `Cultivation '${b_lu}' not found.`,
            )
        }
        return c.json(serialiseCultivation(cultivation), 200)
    }

    const deleteCultivationHandler: RouteHandler<
        typeof deleteCultivationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_lu } = c.req.valid("param") as { b_lu: string }
        await services.removeCultivation(
            fdm,
            principal.effectivePrincipalId,
            b_lu,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(listCultivationsRoute, listCultivationsHandler)
    app.openapi(listFarmCultivationsRoute, listFarmCultivationsHandler)
    app.openapi(createCultivationRoute, createCultivationHandler)
    app.openapi(getCultivationRoute, getCultivationHandler)
    app.openapi(updateCultivationRoute, updateCultivationHandler)
    app.openapi(deleteCultivationRoute, deleteCultivationHandler)
}
