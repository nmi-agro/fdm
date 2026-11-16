import type { OpenAPIHono, RouteHandler } from "@hono/zod-openapi"
import type { FdmType } from "@nmi-agro/fdm-core"
import { createRoute, type z } from "@hono/zod-openapi"
import type { ApiEnv } from "../types"
import {
  CatalogueItemsFilterSchema,
  CatalogueSourcesSchema,
  type CatalogueServices,
  CultivationCatalogueSchema,
  EnabledCultivationCataloguesSchema,
  EnabledFertilizerCataloguesSchema,
  EnabledMeasureCataloguesSchema,
  FertilizerCatalogueSchema,
  listCatalogues,
  listCultivationCatalogueItems,
  listFarmCultivationCatalogues,
  listFarmFertilizerCatalogues,
  listFarmMeasureCatalogues,
  listFertilizerCatalogueItems,
  listMeasureCatalogueItems,
  MeasureCatalogueSchema,
} from "../operations/catalogues"
import { FarmParamsSchema } from "../operations/farms"
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
} from "../schemas"
import { operationContext } from "./operation-context"

export type { CatalogueServices } from "../operations/catalogues"
export { CATALOGUE_SOURCES, FertilizerCatalogueSchema } from "../operations/catalogues"

const ListCatalogueItemsQuerySchema = PaginationQuerySchema.extend(CatalogueItemsFilterSchema.shape)

// -------------------- LIST CATALOGUE ROUTES --------------------
const listAvailableCataloguesRoute = createRoute({
  operationId: listCatalogues.name,
  method: "get",
  path: "/catalogues",
  tags: ["Catalogues"],
  summary: "List the available catalogues",
  description:
    "Lists the available cultivation, fertilizer, and field measure catalogues. The `source` codes can be used to list the items of a catalogue that is enabled on a farm.",
  responses: {
    200: {
      description: "Available catalogues are listed successfully.",
      content: {
        "application/json": {
          schema: CatalogueSourcesSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listEnabledCultivationCataloguesRoute = createRoute({
  operationId: listFarmCultivationCatalogues.name,
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/cultivation",
  tags: ["Catalogues", "Cultivations"],
  summary: "List the enabled cultivation catalogues",
  description: "Lists the enabled cultivation catalogues on a farm.",
  request: { params: FarmParamsSchema },
  responses: {
    200: {
      description: "Enabled cultivation catalogues are listed successfully.",
      content: {
        "application/json": {
          schema: EnabledCultivationCataloguesSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listEnabledFertilizerCataloguesRoute = createRoute({
  operationId: listFarmFertilizerCatalogues.name,
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/fertilizer",
  tags: ["Catalogues", "Fertilizers"],
  summary: "List the enabled fertilizer catalogues",
  description: "Lists the enabled fertilizer catalogues on a farm.",
  request: { params: FarmParamsSchema },
  responses: {
    200: {
      description: "Enabled fertilizer catalogues are listed successfully.",
      content: {
        "application/json": {
          schema: EnabledFertilizerCataloguesSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listEnabledMeasureCataloguesRoute = createRoute({
  operationId: listFarmMeasureCatalogues.name,
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/measure",
  tags: ["Catalogues", "Measures"],
  summary: "List the enabled field measure catalogues",
  description: "Lists the enabled field measure catalogues on a farm.",
  request: { params: FarmParamsSchema },
  responses: {
    200: {
      description: "Enabled field measure catalogues are listed successfully.",
      content: {
        "application/json": {
          schema: EnabledMeasureCataloguesSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
})

const listCultivationCatalogueRoute = createRoute({
  operationId: listCultivationCatalogueItems.name,
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/cultivation/items",
  tags: ["Catalogues", "Cultivations"],
  summary: "List a cultivation catalogue",
  description: "Lists the cultivations in a farm's cultivation catalogue.",
  request: { params: FarmParamsSchema, query: ListCatalogueItemsQuerySchema },
  responses: {
    200: {
      description: "Cultivations in the catalogue are listed successfully.",
      content: { "application/json": { schema: paginatedSchema(CultivationCatalogueSchema) } },
    },
    ...commonErrorResponses,
  },
})

const listFertilizerCatalogueRoute = createRoute({
  operationId: listFertilizerCatalogueItems.name,
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/fertilizer/items",
  tags: ["Catalogues", "Fertilizers"],
  summary: "List a fertilizer catalogue",
  description: "Lists the fertilizers in a farm's fertilizer catalogue.",
  request: { params: FarmParamsSchema, query: ListCatalogueItemsQuerySchema },
  responses: {
    200: {
      description: "Fertilizers in the catalogue are listed successfully.",
      content: { "application/json": { schema: paginatedSchema(FertilizerCatalogueSchema) } },
    },
    ...commonErrorResponses,
  },
})

const listMeasureCatalogueRoute = createRoute({
  operationId: listMeasureCatalogueItems.name,
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/measure/items",
  tags: ["Catalogues", "Measures"],
  summary: "List a field measures catalogue",
  description: "Lists the field measures in a farm's field measure catalogue.",
  request: { params: FarmParamsSchema, query: ListCatalogueItemsQuerySchema },
  responses: {
    200: {
      description: "Field measures in the catalogue are listed successfully.",
      content: { "application/json": { schema: paginatedSchema(MeasureCatalogueSchema) } },
    },
    ...commonErrorResponses,
  },
})

/**
 * Registers the catalogue listing routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers.
 * @param services - Catalogue service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @throws {ApiError} Throws when a requested catalogue is not enabled on the farm.
 * @example
 * ```ts
 * registerCatalogueRoutes(app, fdm, services)
 * ```
 */
export function registerCatalogueRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: CatalogueServices,
): void {
  const listAvailableCataloguesHandler: RouteHandler<
    typeof listAvailableCataloguesRoute,
    ApiEnv
  > = async (c) => {
    return c.json(await listCatalogues.run(operationContext(c, fdm, services), {}), 200)
  }

  /**
   * Builds the handler of a route that lists the enabled catalogues of one type on a farm.
   *
   * @param op - Operation that lists the enabled catalogues of one type.
   * @returns The route handler.
   */
  const enabledCataloguesHandler = (op: typeof listFarmCultivationCatalogues) => async (c: any) => {
    const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
    return c.json(await op.run(operationContext(c, fdm, services), params), 200)
  }

  /**
   * Builds the handler of a route that lists the items in the catalogues of one type.
   *
   * @param op - Operation that lists the catalogue items of one type.
   * @returns The route handler.
   */
  const catalogueItemsHandler =
    (
      op:
        | typeof listCultivationCatalogueItems
        | typeof listFertilizerCatalogueItems
        | typeof listMeasureCatalogueItems,
    ) =>
    async (c: any) => {
      const params = c.req.valid("param") as z.infer<typeof FarmParamsSchema>
      const { limit, offset, ...filter } = c.req.valid("query") as z.infer<
        typeof ListCatalogueItemsQuerySchema
      >
      const items = await op.run(operationContext(c, fdm, services), { ...params, ...filter })
      return c.json(paginatedResponse(items as unknown[], limit, offset), 200)
    }

  app.openapi(listAvailableCataloguesRoute, listAvailableCataloguesHandler)
  app.openapi(
    listEnabledCultivationCataloguesRoute,
    enabledCataloguesHandler(listFarmCultivationCatalogues),
  )
  app.openapi(
    listEnabledFertilizerCataloguesRoute,
    enabledCataloguesHandler(listFarmFertilizerCatalogues),
  )
  app.openapi(
    listEnabledMeasureCataloguesRoute,
    enabledCataloguesHandler(listFarmMeasureCatalogues),
  )
  app.openapi(listCultivationCatalogueRoute, catalogueItemsHandler(listCultivationCatalogueItems))
  app.openapi(listFertilizerCatalogueRoute, catalogueItemsHandler(listFertilizerCatalogueItems))
  app.openapi(listMeasureCatalogueRoute, catalogueItemsHandler(listMeasureCatalogueItems))
}
