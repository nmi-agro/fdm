import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import { createRoute, z } from "@hono/zod-openapi"
import type {
    addMeasure,
    FdmType,
    getMeasure,
    getMeasures,
    Measure,
    removeMeasure,
    updateMeasure,
} from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import {
    commonErrorResponses,
    DateStringSchema,
    PaginationTimeframeQuerySchema,
    paginatedResponse,
    paginatedSchema,
    parseTimeframeQuery,
    serializeDate,
    writeErrorResponses,
} from "../schemas"
import type { ApiEnv, ApiPrincipalContext } from "../types"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the measure data access functions required by the measure routes. */
export interface MeasureServices {
    getMeasures: typeof getMeasures
    getMeasure: typeof getMeasure
    addMeasure: typeof addMeasure
    updateMeasure: typeof updateMeasure
    removeMeasure: typeof removeMeasure
}

const MeasureSchema = z
    .object({
        b_id_measure: z.string(),
        m_id: z.string(),
        b_id: z.string(),
        m_start: DateStringSchema.nullable().describe(
            "Date in YYYY-MM-DD format.",
        ),
        m_end: DateStringSchema.nullable().describe(
            "Date in YYYY-MM-DD format.",
        ),
        m_name: z.string(),
        m_summary: z.string().nullable(),
        m_conflicts: z.array(z.string()).nullable(),
    })
    .openapi("Measure")

const CreateMeasureBodySchema = z
    .object({
        m_id: z.string().describe("Measure catalogue identifier."),
        m_start: DateStringSchema.describe("Date in YYYY-MM-DD format."),
        m_end: DateStringSchema.nullable()
            .optional()
            .describe("Date in YYYY-MM-DD format."),
    })
    .openapi("CreateMeasure")

const UpdateMeasureBodySchema = z
    .object({
        m_start: DateStringSchema.optional().describe(
            "Date in YYYY-MM-DD format.",
        ),
        m_end: DateStringSchema.nullable()
            .optional()
            .describe("Date in YYYY-MM-DD format."),
    })
    .openapi("UpdateMeasure")

const listMeasuresRoute = createRoute({
    method: "get",
    path: "/fields/{b_id}/measures",
    tags: ["Measures"],
    summary: "List measures on a field",
    description: "Returns all measures for the specified field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        query: PaginationTimeframeQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of measures.",
            content: {
                "application/json": { schema: paginatedSchema(MeasureSchema) },
            },
        },
        ...commonErrorResponses,
    },
})

const createMeasureRoute = createRoute({
    method: "post",
    path: "/fields/{b_id}/measures",
    tags: ["Measures"],
    summary: "Create a measure",
    description: "Creates a new measure on the specified field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        body: {
            content: {
                "application/json": { schema: CreateMeasureBodySchema },
            },
            required: true,
        },
    },
    responses: {
        201: {
            description: "Measure created.",
            content: { "application/json": { schema: MeasureSchema } },
        },
        ...writeErrorResponses,
    },
})

const getMeasureRoute = createRoute({
    method: "get",
    path: "/measures/{b_id_measure}",
    tags: ["Measures"],
    summary: "Get a measure",
    description: "Returns a single measure by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_measure: z.string() }) },
    responses: {
        200: {
            description: "The requested measure.",
            content: { "application/json": { schema: MeasureSchema } },
        },
        ...commonErrorResponses,
    },
})

const updateMeasureRoute = createRoute({
    method: "patch",
    path: "/measures/{b_id_measure}",
    tags: ["Measures"],
    summary: "Update a measure",
    description: "Partially updates an existing measure.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_measure: z.string() }),
        body: {
            content: {
                "application/json": { schema: UpdateMeasureBodySchema },
            },
            required: true,
        },
    },
    responses: {
        200: {
            description: "Measure updated.",
            content: { "application/json": { schema: MeasureSchema } },
        },
        ...writeErrorResponses,
    },
})

const deleteMeasureRoute = createRoute({
    method: "delete",
    path: "/measures/{b_id_measure}",
    tags: ["Measures"],
    summary: "Delete a measure",
    description: "Permanently deletes a measure.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_measure: z.string() }) },
    responses: {
        204: { description: "Measure deleted." },
        ...commonErrorResponses,
    },
})

function serialiseMeasure(measure: Measure) {
    return {
        b_id_measure: measure.b_id_measure,
        m_id: measure.m_id,
        b_id: measure.b_id,
        m_start: serializeDate(measure.m_start),
        m_end: serializeDate(measure.m_end),
        m_name: measure.m_name,
        m_summary: measure.m_summary ?? null,
        m_conflicts: measure.m_conflicts ?? null,
    }
}

/**
 * Registers the measure CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Measure service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested measure cannot be found.
 * @example
 * ```ts
 * registerMeasureRoutes(app, fdm, services)
 * ```
 */
export function registerMeasureRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: MeasureServices,
): void {
    // /fields/*/measures is covered by the /fields/* middleware in fields.ts
    app.use("/measures", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )
    app.use("/measures/*", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listMeasuresHandler: RouteHandler<typeof listMeasuresRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const query = c.req.valid("query") as z.infer<
            typeof PaginationTimeframeQuerySchema
        >
        const measures = await services.getMeasures(
            fdm,
            principal.effectivePrincipalId,
            b_id,
            parseTimeframeQuery(query),
        )
        return c.json(
            paginatedResponse(
                measures.map(serialiseMeasure),
                query.limit,
                query.offset,
            ),
            200,
        )
    }

    const createMeasureHandler: RouteHandler<
        typeof createMeasureRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof CreateMeasureBodySchema
        >
        const b_id_measure = await services.addMeasure(
            fdm,
            principal.effectivePrincipalId,
            b_id,
            body.m_id,
            new Date(body.m_start),
            body.m_end ? new Date(body.m_end) : undefined,
        )
        const measure = await services.getMeasure(
            fdm,
            principal.effectivePrincipalId,
            b_id_measure,
        )
        if (!measure?.b_id_measure) {
            throw new ApiError(
                500,
                "internal-error",
                "Measure created but could not be retrieved.",
            )
        }
        c.header(
            "Location",
            `${new URL(c.req.url).origin}/measures/${b_id_measure}`,
        )
        return c.json(serialiseMeasure(measure), 201)
    }

    const getMeasureHandler: RouteHandler<typeof getMeasureRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_measure } = c.req.valid("param") as {
            b_id_measure: string
        }
        const measure = await services.getMeasure(
            fdm,
            principal.effectivePrincipalId,
            b_id_measure,
        )
        if (!measure?.b_id_measure) {
            throw new ApiError(
                404,
                "not-found",
                `Measure '${b_id_measure}' not found.`,
            )
        }
        return c.json(serialiseMeasure(measure), 200)
    }

    const updateMeasureHandler: RouteHandler<
        typeof updateMeasureRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_measure } = c.req.valid("param") as {
            b_id_measure: string
        }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof UpdateMeasureBodySchema
        >
        if (Object.values(body).every((value) => value === undefined)) {
            throw new ApiError(
                400,
                "validation-failed",
                "At least one field must be provided.",
            )
        }
        await services.updateMeasure(
            fdm,
            principal.effectivePrincipalId,
            b_id_measure,
            body.m_start ? new Date(body.m_start) : undefined,
            body.m_end === undefined
                ? undefined
                : body.m_end
                  ? new Date(body.m_end)
                  : null,
        )
        const measure = await services.getMeasure(
            fdm,
            principal.effectivePrincipalId,
            b_id_measure,
        )
        if (!measure?.b_id_measure) {
            throw new ApiError(
                404,
                "not-found",
                `Measure '${b_id_measure}' not found.`,
            )
        }
        return c.json(serialiseMeasure(measure), 200)
    }

    const deleteMeasureHandler: RouteHandler<
        typeof deleteMeasureRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_measure } = c.req.valid("param") as {
            b_id_measure: string
        }
        await services.removeMeasure(
            fdm,
            principal.effectivePrincipalId,
            b_id_measure,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(listMeasuresRoute, listMeasuresHandler)
    app.openapi(createMeasureRoute, createMeasureHandler)
    app.openapi(getMeasureRoute, getMeasureHandler)
    app.openapi(updateMeasureRoute, updateMeasureHandler)
    app.openapi(deleteMeasureRoute, deleteMeasureHandler)
}
