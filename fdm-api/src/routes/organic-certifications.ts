import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import { createRoute, z } from "@hono/zod-openapi"
import type {
    addOrganicCertification,
    FdmType,
    getOrganicCertification,
    listOrganicCertifications,
    OrganicCertification,
    removeOrganicCertification,
} from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import {
    commonErrorResponses,
    DateStringSchema,
    PaginationQuerySchema,
    paginatedResponse,
    paginatedSchema,
    serializeDate,
    writeErrorResponses,
} from "../schemas"
import type { ApiEnv, ApiPrincipalContext } from "../types"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/** Defines the organic certification data access functions required by the organic certification routes. */
export interface OrganicCertificationServices {
    listOrganicCertifications: typeof listOrganicCertifications
    addOrganicCertification: typeof addOrganicCertification
    getOrganicCertification: typeof getOrganicCertification
    removeOrganicCertification: typeof removeOrganicCertification
}

const OrganicCertificationSchema = z
    .object({
        b_id_organic: z.string(),
        b_organic_traces: z.string().nullable(),
        b_organic_skal: z.string().nullable(),
        b_organic_issued: DateStringSchema.nullable().describe(
            "Date in YYYY-MM-DD format.",
        ),
        b_organic_expires: DateStringSchema.nullable().describe(
            "Date in YYYY-MM-DD format.",
        ),
    })
    .openapi("OrganicCertification")

const CreateOrganicCertificationBodySchema = z
    .object({
        b_organic_traces: z
            .string()
            .nullable()
            .optional()
            .describe("Organic TRACES number."),
        b_organic_skal: z
            .string()
            .nullable()
            .optional()
            .describe("Organic SKAL number."),
        b_organic_issued: DateStringSchema.describe(
            "Date in YYYY-MM-DD format.",
        ),
        b_organic_expires: DateStringSchema.describe(
            "Date in YYYY-MM-DD format.",
        ),
    })
    .openapi("CreateOrganicCertification")

const listOrganicCertificationsRoute = createRoute({
    method: "get",
    path: "/farms/{b_id_farm}/organic-certifications",
    tags: ["Organic Certifications"],
    summary: "List organic certifications on a farm",
    description: "Returns all organic certifications for the specified farm.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        query: PaginationQuerySchema,
    },
    responses: {
        200: {
            description: "A paginated list of organic certifications.",
            content: {
                "application/json": {
                    schema: paginatedSchema(OrganicCertificationSchema),
                },
            },
        },
        ...commonErrorResponses,
    },
})

const createOrganicCertificationRoute = createRoute({
    method: "post",
    path: "/farms/{b_id_farm}/organic-certifications",
    tags: ["Organic Certifications"],
    summary: "Create an organic certification",
    description: "Creates a new organic certification on the specified farm.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        body: {
            content: {
                "application/json": {
                    schema: CreateOrganicCertificationBodySchema,
                },
            },
            required: true,
        },
    },
    responses: {
        201: {
            description: "Organic certification created.",
            content: {
                "application/json": { schema: OrganicCertificationSchema },
            },
        },
        ...writeErrorResponses,
    },
})

const getOrganicCertificationRoute = createRoute({
    method: "get",
    path: "/organic-certifications/{b_id_organic}",
    tags: ["Organic Certifications"],
    summary: "Get an organic certification",
    description: "Returns a single organic certification by ID.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_organic: z.string() }) },
    responses: {
        200: {
            description: "The requested organic certification.",
            content: {
                "application/json": { schema: OrganicCertificationSchema },
            },
        },
        ...commonErrorResponses,
    },
})

const deleteOrganicCertificationRoute = createRoute({
    method: "delete",
    path: "/organic-certifications/{b_id_organic}",
    tags: ["Organic Certifications"],
    summary: "Delete an organic certification",
    description: "Permanently deletes an organic certification.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_organic: z.string() }) },
    responses: {
        204: { description: "Organic certification deleted." },
        ...commonErrorResponses,
    },
})

function serialiseOrganicCertification(certification: OrganicCertification) {
    return {
        b_id_organic: certification.b_id_organic,
        b_organic_traces: certification.b_organic_traces ?? null,
        b_organic_skal: certification.b_organic_skal ?? null,
        b_organic_issued: serializeDate(certification.b_organic_issued),
        b_organic_expires: serializeDate(certification.b_organic_expires),
    }
}

/**
 * Registers the organic certification CRUD routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers and rate limiting.
 * @param services - Organic certification service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested organic certification cannot be found.
 * @example
 * ```ts
 * registerOrganicCertificationRoutes(app, fdm, services)
 * ```
 */
export function registerOrganicCertificationRoutes(
    app: OpenAPIHono<ApiEnv>,
    fdm: FdmType,
    services: OrganicCertificationServices,
): void {
    // /farms/*/organic-certifications is covered by the /farms/* middleware in farms.ts
    app.use("/organic-certifications", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )
    app.use("/organic-certifications/*", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listOrganicCertificationsHandler: RouteHandler<
        typeof listOrganicCertificationsRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<
            typeof PaginationQuerySchema
        >
        const certifications = await services.listOrganicCertifications(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        return c.json(
            paginatedResponse(
                certifications.map(serialiseOrganicCertification),
                limit,
                offset,
            ),
            200,
        )
    }

    const createOrganicCertificationHandler: RouteHandler<
        typeof createOrganicCertificationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<
            typeof CreateOrganicCertificationBodySchema
        >
        const b_id_organic = await services.addOrganicCertification(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            body.b_organic_traces ?? null,
            body.b_organic_skal ?? null,
            new Date(body.b_organic_issued),
            new Date(body.b_organic_expires),
        )
        const certification = await services.getOrganicCertification(
            fdm,
            principal.effectivePrincipalId,
            b_id_organic,
        )
        if (!certification?.b_id_organic) {
            throw new ApiError(
                500,
                "internal-error",
                "Organic certification created but could not be retrieved.",
            )
        }
        c.header(
            "Location",
            `${new URL(c.req.url).origin}/organic-certifications/${b_id_organic}`,
        )
        return c.json(serialiseOrganicCertification(certification), 201)
    }

    const getOrganicCertificationHandler: RouteHandler<
        typeof getOrganicCertificationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_organic } = c.req.valid("param") as {
            b_id_organic: string
        }
        const certification = await services.getOrganicCertification(
            fdm,
            principal.effectivePrincipalId,
            b_id_organic,
        )
        if (!certification?.b_id_organic) {
            throw new ApiError(
                404,
                "not-found",
                `Organic certification '${b_id_organic}' not found.`,
            )
        }
        return c.json(serialiseOrganicCertification(certification), 200)
    }

    const deleteOrganicCertificationHandler: RouteHandler<
        typeof deleteOrganicCertificationRoute
    > = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_organic } = c.req.valid("param") as {
            b_id_organic: string
        }
        await services.removeOrganicCertification(
            fdm,
            principal.effectivePrincipalId,
            b_id_organic,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(
        listOrganicCertificationsRoute,
        listOrganicCertificationsHandler,
    )
    app.openapi(
        createOrganicCertificationRoute,
        createOrganicCertificationHandler,
    )
    app.openapi(getOrganicCertificationRoute, getOrganicCertificationHandler)
    app.openapi(
        deleteOrganicCertificationRoute,
        deleteOrganicCertificationHandler,
    )
}
