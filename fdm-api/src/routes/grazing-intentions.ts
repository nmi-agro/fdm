import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import { FarmParamsSchema } from "../operations/farms"
import {
  deleteGrazingIntention,
  GrazingIntentionParamsSchema,
  GrazingIntentionSchema,
  type GrazingIntentionServices,
  listGrazingIntentions,
  SetGrazingIntentionBodySchema,
  setGrazingIntention,
} from "../operations/grazing-intentions"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
  writeErrorResponses,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { GrazingIntentionServices } from "../operations/grazing-intentions"

const listGrazingIntentionsRoute = createRoute({
  operationId: listGrazingIntentions.name,
  method: "get",
  path: "/farms/{b_id_farm}/grazing-intentions",
  tags: ["Grazing Intentions"],
  summary: "List grazing intentions on a farm",
  description: "Returns all grazing intentions for the specified farm.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: FarmParamsSchema,
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
  operationId: setGrazingIntention.name,
  method: "put",
  path: "/farms/{b_id_farm}/grazing-intentions/{b_grazing_intention_year}",
  tags: ["Grazing Intentions"],
  summary: "Set a grazing intention",
  description: "Creates or updates a grazing intention for the specified farm and year.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: GrazingIntentionParamsSchema,
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
  operationId: deleteGrazingIntention.name,
  method: "delete",
  path: "/farms/{b_id_farm}/grazing-intentions/{b_grazing_intention_year}",
  tags: ["Grazing Intentions"],
  summary: "Delete a grazing intention",
  description: "Deletes a grazing intention for the specified farm and year.",
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  request: {
    params: GrazingIntentionParamsSchema,
  },
  responses: {
    204: { description: "Grazing intention deleted." },
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
  const listGrazingIntentionsHandler: RouteHandler<typeof listGrazingIntentionsRoute> = async (
    c,
  ) => {
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const intentions = await listGrazingIntentions.run(operationContext(c, fdm, services), params)
    return c.json(paginatedResponse(intentions, limit, offset), 200)
  }

  const putGrazingIntentionHandler: RouteHandler<typeof putGrazingIntentionRoute> = async (c) => {
    const params = c.req.valid("param" as never) as z.infer<typeof GrazingIntentionParamsSchema>
    // @ts-expect-error: @hono/zod-openapi type inference is broken with TypeScript 6 + Zod v4
    const body = c.req.valid("json") as z.infer<typeof SetGrazingIntentionBodySchema>
    const intention = await setGrazingIntention.run(operationContext(c, fdm, services), {
      ...params,
      ...body,
    })
    return c.json(intention, 200)
  }

  const deleteGrazingIntentionHandler: RouteHandler<typeof deleteGrazingIntentionRoute> = async (
    c,
  ) => {
    const params = c.req.valid("param" as never) as z.infer<typeof GrazingIntentionParamsSchema>
    await deleteGrazingIntention.run(operationContext(c, fdm, services), params)
    return c.newResponse(null, 204)
  }

  app.openapi(listGrazingIntentionsRoute, listGrazingIntentionsHandler)
  app.openapi(putGrazingIntentionRoute, putGrazingIntentionHandler)
  app.openapi(deleteGrazingIntentionRoute, deleteGrazingIntentionHandler)
}
