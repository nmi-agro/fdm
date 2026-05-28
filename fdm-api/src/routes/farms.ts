import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import { createRoute, z } from "@hono/zod-openapi"
import type {
    addFarm,
    FdmType,
    getFarm,
    getFarms,
    removeFarm,
    updateFarm,
} from "@nmi-agro/fdm-core"
import { ApiError } from "../error"
import { rateLimitMiddleware } from "../rate-limit"
import {
    commonErrorResponses,
    PaginationQuerySchema,
    paginatedResponse,
    paginatedSchema,
    writeErrorResponses,
} from "../schemas"
import type { ApiEnv, ApiPrincipalContext } from "../types"

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"])

/**
 * Defines the farm data access functions required by the farm routes.
 */
export interface FarmServices {
    /** Returns all farms visible to the authenticated principal. */
    getFarms: typeof getFarms
    /** Returns a single farm visible to the authenticated principal. */
    getFarm: typeof getFarm
    /** Creates a new farm owned by the authenticated principal. */
    addFarm: typeof addFarm
    /** Updates the metadata of an existing farm. */
    updateFarm: typeof updateFarm
    /** Permanently deletes a farm and all its associated resources. */
    removeFarm: typeof removeFarm
}

const FarmSchema = z
    .object({
        b_id_farm: z.string(),
        b_name_farm: z.string().nullable(),
        b_businessid_farm: z.string().nullable(),
        b_address_farm: z.string().nullable(),
        b_postalcode_farm: z.string().nullable(),
    })
    .openapi("Farm")

const CreateFarmBodySchema = z
    .object({
        b_name_farm: z.string().optional().describe("Farm display name."),
        b_businessid_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Chamber of commerce or business registration number."),
        b_address_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Street address of the farm."),
        b_postalcode_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Postal code of the farm address."),
    })
    .openapi("CreateFarm")

const UpdateFarmBodySchema = z
    .object({
        b_name_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Farm display name."),
        b_businessid_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Chamber of commerce or business registration number."),
        b_address_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Street address of the farm."),
        b_postalcode_farm: z
            .string()
            .nullable()
            .optional()
            .describe("Postal code of the farm address."),
    })
    .openapi("UpdateFarm")

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
            content: {
                "application/json": { schema: paginatedSchema(FarmSchema) },
            },
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

const createFarmRoute = createRoute({
    method: "post",
    path: "/farms",
    tags: ["Farms"],
    summary: "Create a farm",
    description:
        "Creates a new farm. The authenticated API key's owner becomes the farm owner.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        body: {
            content: { "application/json": { schema: CreateFarmBodySchema } },
            required: true,
        },
    },
    responses: {
        201: {
            description: "Farm created.",
            content: { "application/json": { schema: FarmSchema } },
        },
        ...writeErrorResponses,
    },
})

const updateFarmRoute = createRoute({
    method: "patch",
    path: "/farms/{b_id_farm}",
    tags: ["Farms"],
    summary: "Update a farm",
    description:
        "Partially updates the metadata of an existing farm. Only supplied fields are changed.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: {
        params: z.object({ b_id_farm: z.string() }),
        body: {
            content: { "application/json": { schema: UpdateFarmBodySchema } },
            required: true,
        },
    },
    responses: {
        200: {
            description: "Farm updated.",
            content: { "application/json": { schema: FarmSchema } },
        },
        ...writeErrorResponses,
    },
})

const deleteFarmRoute = createRoute({
    method: "delete",
    path: "/farms/{b_id_farm}",
    tags: ["Farms"],
    summary: "Delete a farm",
    description:
        "Permanently deletes a farm and all its associated fields, cultivations, and soil analyses.",
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    request: { params: z.object({ b_id_farm: z.string() }) },
    responses: {
        204: { description: "Farm deleted." },
        ...commonErrorResponses,
    },
})

function serialiseFarm(farm: {
    b_id_farm: string
    b_name_farm: string | null
    b_businessid_farm: string | null
    b_address_farm: string | null
    b_postalcode_farm: string | null
}) {
    return {
        b_id_farm: farm.b_id_farm,
        b_name_farm: farm.b_name_farm ?? null,
        b_businessid_farm: farm.b_businessid_farm ?? null,
        b_address_farm: farm.b_address_farm ?? null,
        b_postalcode_farm: farm.b_postalcode_farm ?? null,
    }
}

/**
 * Registers the farm CRUD routes on the API application.
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
    app.use("/farms", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )
    app.use("/farms/*", (c, next) =>
        rateLimitMiddleware(
            fdm,
            WRITE_METHODS.has(c.req.method) ? "write" : "general",
        )(c, next),
    )

    const listFarmsHandler: RouteHandler<typeof listFarmsRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { limit, offset } = c.req.valid("query") as z.infer<
            typeof PaginationQuerySchema
        >
        const farms = await services.getFarms(
            fdm,
            principal.effectivePrincipalId,
        )
        return c.json(
            paginatedResponse(farms.map(serialiseFarm), limit, offset),
            200,
        )
    }

    const getFarmHandler: RouteHandler<typeof getFarmRoute> = async (c) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        const farm = await services.getFarm(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        if (!farm?.b_id_farm) {
            throw new ApiError(
                404,
                "not-found",
                `Farm '${b_id_farm}' not found.`,
            )
        }
        return c.json(serialiseFarm(farm), 200)
    }

    const createFarmHandler: RouteHandler<typeof createFarmRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<typeof CreateFarmBodySchema>
        const b_id_farm = await services.addFarm(
            fdm,
            principal.effectivePrincipalId,
            body.b_name_farm ?? null,
            body.b_businessid_farm ?? null,
            body.b_address_farm ?? null,
            body.b_postalcode_farm ?? null,
        )
        const farm = await services.getFarm(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        if (!farm?.b_id_farm) {
            throw new ApiError(
                500,
                "internal-error",
                "Farm created but could not be retrieved.",
            )
        }
        c.header("Location", `${new URL(c.req.url).origin}/farms/${b_id_farm}`)
        return c.json(serialiseFarm(farm), 201)
    }

    const updateFarmHandler: RouteHandler<typeof updateFarmRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const body = c.req.valid("json") as z.infer<typeof UpdateFarmBodySchema>
        if (Object.values(body).every((v) => v === undefined)) {
            throw new ApiError(
                400,
                "validation-failed",
                "At least one field must be provided.",
            )
        }
        const existing = await services.getFarm(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        if (!existing?.b_id_farm) {
            throw new ApiError(
                404,
                "not-found",
                `Farm '${b_id_farm}' not found.`,
            )
        }
        const updated = await services.updateFarm(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
            body.b_name_farm !== undefined
                ? body.b_name_farm
                : existing.b_name_farm,
            body.b_businessid_farm !== undefined
                ? body.b_businessid_farm
                : existing.b_businessid_farm,
            body.b_address_farm !== undefined
                ? body.b_address_farm
                : existing.b_address_farm,
            body.b_postalcode_farm !== undefined
                ? body.b_postalcode_farm
                : existing.b_postalcode_farm,
        )
        if (!updated?.b_id_farm) {
            throw new ApiError(
                404,
                "not-found",
                `Farm '${b_id_farm}' not found.`,
            )
        }
        return c.json(serialiseFarm(updated), 200)
    }

    const deleteFarmHandler: RouteHandler<typeof deleteFarmRoute> = async (
        c,
    ) => {
        const principal = c.get("principal") as unknown as ApiPrincipalContext
        // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
        const { b_id_farm } = c.req.valid("param") as { b_id_farm: string }
        await services.removeFarm(
            fdm,
            principal.effectivePrincipalId,
            b_id_farm,
        )
        return c.newResponse(null, 204)
    }

    app.openapi(listFarmsRoute, listFarmsHandler)
    app.openapi(getFarmRoute, getFarmHandler)
    app.openapi(createFarmRoute, createFarmHandler)
    app.openapi(updateFarmRoute, updateFarmHandler)
    app.openapi(deleteFarmRoute, deleteFarmHandler)
}
