import { createRoute, z } from "@hono/zod-openapi"
import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type {
    addFertilizerApplication,
    getFertilizerApplication,
    getFertilizerApplications,
    removeFertilizerApplication,
    updateFertilizerApplication,
} from "@nmi-agro/fdm-core"
import type { FertilizerApplication } from "@nmi-agro/fdm-core"
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

/** Defines the fertilizer application data access functions required by the fertilizer application routes. */
export interface FertilizerApplicationServices {
    getFertilizerApplications: typeof getFertilizerApplications
    getFertilizerApplication: typeof getFertilizerApplication
    addFertilizerApplication: typeof addFertilizerApplication
    updateFertilizerApplication: typeof updateFertilizerApplication
    removeFertilizerApplication: typeof removeFertilizerApplication
}

const FertilizerApplicationSchema = z
    .object({
        p_id: z.string(),
        p_id_catalogue: z.string(),
        p_name_nl: z.string().nullable(),
        p_app_amount: z.number().nullable(),
        p_app_amount_unit: z.string(),
        p_app_amount_display: z.number().nullable(),
        p_app_method: z.string().nullable(),
        p_app_date: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
        p_app_id: z.string(),
    })
    .openapi("FertilizerApplication")

const CreateFertilizerApplicationBodySchema = z
    .object({
        p_id: z.string().describe("Fertilizer identifier."),
        p_app_amount_display: z
            .number()
            .describe("Application amount in the display unit."),
        p_app_method: z.string().nullable().describe("Application method."),
        p_app_date: DateStringSchema
            .describe("Date in YYYY-MM-DD format."),
    })
    .openapi("CreateFertilizerApplication")

const UpdateFertilizerApplicationBodySchema = z
    .object({
        p_id: z.string().optional().describe("Fertilizer identifier."),
        p_app_amount_display: z
            .number()
            .nullable()
            .optional()
            .describe("Application amount in the display unit."),
        p_app_method: z
            .string()
            .nullable()
            .optional()
            .describe("Application method."),
        p_app_date: DateStringSchema
            .optional()
            .describe("Date in YYYY-MM-DD format."),
    })
    .openapi("UpdateFertilizerApplication")

const listFertilizerApplicationsRoute = createRoute({
    method: "get",
    path: "/fields/{b_id}/fertilizer-applications",
    tags: ["Fertilizer Applications"],
    summary: "List fertilizer applications on a field",
    description: "Returns all fertilizer applications for the specified field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        query: PaginationTimeframeQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of fertilizer applications.",
            content: {
                "application/json": {
                    schema: paginatedSchema(FertilizerApplicationSchema),
                },
            },
        },
        ...commonErrorResponses,
    },
})

const createFertilizerApplicationRoute = createRoute({
    method: "post",
    path: "/fields/{b_id}/fertilizer-applications",
    tags: ["Fertilizer Applications"],
    summary: "Create a fertilizer application",
    description: "Creates a new fertilizer application on the specified field.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id: z.string() }),
        body: {
            content: {
                "application/json": {
                    schema: CreateFertilizerApplicationBodySchema,
                },
            },
            required: true,
        },
    },
    responses: {
        201: {
            description: "Fertilizer application created.",
            content: {
                "application/json": { schema: FertilizerApplicationSchema },
            },
        },
        ...writeErrorResponses,
    },
})

const getFertilizerApplicationRoute = createRoute({
    method: "get",
    path: "/fertilizer-applications/{p_app_id}",
    tags: ["Fertilizer Applications"],
    summary: "Get a fertilizer application",
    description: "Returns a single fertilizer application by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ p_app_id: z.string() }) },
    responses: {
        200: {
            description: "The requested fertilizer application.",
            content: {
                "application/json": { schema: FertilizerApplicationSchema },
            },
        },
        ...commonErrorResponses,
    },
})

const updateFertilizerApplicationRoute = createRoute({
    method: "patch",
    path: "/fertilizer-applications/{p_app_id}",
    tags: ["Fertilizer Applications"],
    summary: "Update a fertilizer application",
    description: "Partially updates an existing fertilizer application.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ p_app_id: z.string() }),
        body: {
            content: {
                "application/json": {
                    schema: UpdateFertilizerApplicationBodySchema,
                },
            },
            required: true,
        },
    },
    responses: {
        200: {
            description: "Fertilizer application updated.",
            content: {
                "application/json": { schema: FertilizerApplicationSchema },
            },
        },
        ...writeErrorResponses,
    },
})

const deleteFertilizerApplicationRoute = createRoute({
    method: "delete",
    path: "/fertilizer-applications/{p_app_id}",
    tags: ["Fertilizer Applications"],
    summary: "Delete a fertilizer application",
    description: "Permanently deletes a fertilizer application.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ p_app_id: z.string() }) },
    responses: {
        204: { description: "Fertilizer application deleted." },
        ...commonErrorResponses,
    },
})

function serialiseFertilizerApplication(application: FertilizerApplication) {
    return {
        p_id: application.p_id,
        p_id_catalogue: application.p_id_catalogue,
        p_name_nl: application.p_name_nl ?? null,
        p_app_amount: application.p_app_amount ?? null,
        p_app_amount_unit: application.p_app_amount_unit,
        p_app_amount_display: application.p_app_amount_display ?? null,
        p_app_method: application.p_app_method ?? null,
        p_app_date: serializeDate(application.p_app_date),
        p_app_id: application.p_app_id,
    }
}

/**
 * Registers the fertilizer application CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Fertilizer application service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested fertilizer application cannot be found.
 * @example
 * ```ts
 * registerFertilizerApplicationRoutes(app, fdm, services)
 * ```
 */
export function registerFertilizerApplicationRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: FertilizerApplicationServices,
): void {
    // /fields/*/fertilizer-applications is covered by the /fields/* middleware in fields.ts
    app.use("/fertilizer-applications", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )
    app.use("/fertilizer-applications/*", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listFertilizerApplicationsHandler: RouteHandler<
        typeof listFertilizerApplicationsRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const query = c.req.valid("query") as z.infer<
            typeof PaginationTimeframeQuerySchema
        >
        const applications = await services.getFertilizerApplications(
            fdm,
            principal.effectivePrincipalId,
            b_id,
            parseTimeframeQuery(query),
        )
        return c.json(
            paginatedResponse(
                applications.map(serialiseFertilizerApplication),
                query.limit,
                query.offset,
            ),
            200,
        )
    }

    const createFertilizerApplicationHandler: RouteHandler<
        typeof createFertilizerApplicationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id } = c.req.valid("param") as { b_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof CreateFertilizerApplicationBodySchema
        >
        const p_app_id = await services.addFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            b_id,
            body.p_id,
            body.p_app_amount_display,
            body.p_app_method,
            new Date(body.p_app_date),
        )
        const application = await services.getFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            p_app_id,
        )
        if (!application?.p_app_id) {
            throw new ApiError(
                500,
                "internal-error",
                "Fertilizer application created but could not be retrieved.",
            )
        }
        c.header(
            "Location",
            `${new URL(c.req.url).origin}/fertilizer-applications/${p_app_id}`,
        )
        return c.json(serialiseFertilizerApplication(application), 201)
    }

    const getFertilizerApplicationHandler: RouteHandler<
        typeof getFertilizerApplicationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { p_app_id } = c.req.valid("param") as { p_app_id: string }
        const application = await services.getFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            p_app_id,
        )
        if (!application?.p_app_id) {
            throw new ApiError(
                404,
                "not-found",
                `Fertilizer application '${p_app_id}' not found.`,
            )
        }
        return c.json(serialiseFertilizerApplication(application), 200)
    }

    const updateFertilizerApplicationHandler: RouteHandler<
        typeof updateFertilizerApplicationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { p_app_id } = c.req.valid("param") as { p_app_id: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof UpdateFertilizerApplicationBodySchema
        >
        if (Object.values(body).every((value) => value === undefined)) {
            throw new ApiError(
                400,
                "validation-failed",
                "At least one field must be provided.",
            )
        }
        const existing = await services.getFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            p_app_id,
        )
        if (!existing?.p_app_id) {
            throw new ApiError(
                404,
                "not-found",
                `Fertilizer application '${p_app_id}' not found.`,
            )
        }
        await services.updateFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            p_app_id,
            body.p_id !== undefined ? body.p_id : existing.p_id,
            body.p_app_amount_display !== undefined
                ? body.p_app_amount_display
                : existing.p_app_amount_display,
            body.p_app_method !== undefined
                ? body.p_app_method
                : existing.p_app_method,
            body.p_app_date !== undefined
                ? new Date(body.p_app_date)
                : existing.p_app_date,
        )
        const application = await services.getFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            p_app_id,
        )
        if (!application?.p_app_id) {
            throw new ApiError(
                404,
                "not-found",
                `Fertilizer application '${p_app_id}' not found.`,
            )
        }
        return c.json(serialiseFertilizerApplication(application), 200)
    }

    const deleteFertilizerApplicationHandler: RouteHandler<
        typeof deleteFertilizerApplicationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { p_app_id } = c.req.valid("param") as { p_app_id: string }
        await services.removeFertilizerApplication(
            fdm,
            principal.effectivePrincipalId,
            p_app_id,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(
        listFertilizerApplicationsRoute,
        listFertilizerApplicationsHandler,
    )
    app.openapi(
        createFertilizerApplicationRoute,
        createFertilizerApplicationHandler,
    )
    app.openapi(getFertilizerApplicationRoute, getFertilizerApplicationHandler)
    app.openapi(
        updateFertilizerApplicationRoute,
        updateFertilizerApplicationHandler,
    )
    app.openapi(
        deleteFertilizerApplicationRoute,
        deleteFertilizerApplicationHandler,
    )
}
