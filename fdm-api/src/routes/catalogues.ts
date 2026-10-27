import type { OpenAPIHono } from "@hono/zod-openapi"
import { createRoute, z } from "@hono/zod-openapi"
import {
  getMeasuresFromCatalogue,
  type disableCultivationCatalogue,
  type disableFertilizerCatalogue,
  type disableMeasureCatalogue,
  type enableCultivationCatalogue,
  type enableFertilizerCatalogue,
  type enableMeasureCatalogue,
  type FdmType,
  type getCultivationsFromCatalogues,
  type getEnabledCultivationCatalogues,
  type getEnabledFertilizerCatalogues,
  type getEnabledMeasureCatalogues,
  type getFertilizersFromCatalogues,
} from "@nmi-agro/fdm-core"
import type { ApiEnv, ApiPrincipalContext } from "../types"
import { ApiError } from "../error"
import { commonErrorResponses } from "../schemas"

interface CatalogueSource {
  source: string
  title: string
}

export const CATALOGUE_SOURCES = {
  cultivation: [
    {
      source: "brp",
      title: "Gewascodes in Basisregistratie Percelen",
    },
  ],
  fertilizer: [
    {
      source: "baat",
      title: "Betere Akkerbouw Adviezen Toekomstgericht",
    },
  ],
  measure: [
    {
      source: "bln",
      title: "BLN3 Maatregelencatalogus",
    },
  ],
} as const satisfies Record<string, CatalogueSource[]>

const ListEnabledCataloguesParamsSchema = z.object({
  b_id_farm: z.string(),
})

const ListCatalogueItemsParamsSchema = z.object({
  b_id_farm: z.string(),
  source: z.string().describe("Catalogue source identifier."),
})

/**
 * Defines the catalogue data access functions required by the catalogue routes.
 */
export interface CatalogueServices {
  /** Gets the list of enabled cultivation catalogues on a farm. */
  getEnabledCultivationCatalogues: typeof getEnabledCultivationCatalogues
  /** Gets the list of enabled fertilizer catalogues on a farm. */
  getEnabledFertilizerCatalogues: typeof getEnabledFertilizerCatalogues
  /** Gets the list of enabled field measure catalogues on a farm. */
  getEnabledMeasureCatalogues: typeof getEnabledMeasureCatalogues
  /** Gets the cultivations in a list of catalogues. */
  getCultivationsFromCatalogues: typeof getCultivationsFromCatalogues
  /** Gets the fertilizers in a list of catalogues. */
  getFertilizersFromCatalogues: typeof getFertilizersFromCatalogues
  /** Gets the BLN3 measures catalogue. */
  getMeasuresFromCatalogue: typeof getMeasuresFromCatalogue
  /** Enables a fertilizer catalogue for the farm. */
  enableFertilizerCatalogue: typeof enableFertilizerCatalogue
  /** Enables a cultivation catalogue for the farm. */
  enableCultivationCatalogue: typeof enableCultivationCatalogue
  /** Enables a field measure catalogue for the farm. */
  enableMeasureCatalogue: typeof enableMeasureCatalogue
  /** Disables a fertilizer catalogue for the farm. */
  disableFertilizerCatalogue: typeof disableFertilizerCatalogue
  /** Disables a cultivation catalogue for the farm. */
  disableCultivationCatalogue: typeof disableCultivationCatalogue
  /** Disables a field measure catalogue for the farm. */
  disableMeasureCatalogue: typeof disableMeasureCatalogue
}

// -------------------- LIST CATALOGUE ROUTES --------------------
const listAvailableCataloguesRoute = createRoute({
  method: "get",
  path: "/catalogues",
  tags: ["Catalogues", "Cultivations", "Fertilizers", "Measures"],
  summary: "List the available catalogues",
  description:
    "Lists the available cultivation, fertilizer, and field measure catalogues that can be enabled on a farm. Enable/disable endpoints may be called by using `source` as the last parameter.",
  responses: {
    200: {
      description: "Available catalogues are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

const listEnabledCultivationCataloguesRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/cultivation",
  tags: ["Catalogues", "Cultivations"],
  summary: "List the enabled cultivation catalogues",
  description: "Lists the enabled cultivation catalogues on a farm.",
  request: { params: ListEnabledCataloguesParamsSchema },
  responses: {
    200: {
      description: "Enabled cultivation catalogues are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

const listEnabledFertilizerCataloguesRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/fertilizer",
  tags: ["Catalogues", "Fertilizers"],
  summary: "List the enabled fertilizer catalogues",
  description: "Lists the enabled fertilizer catalogues on a farm.",
  request: { params: ListEnabledCataloguesParamsSchema },
  responses: {
    200: {
      description: "Enabled fertilizer catalogues are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

const listEnabledMeasureCataloguesRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/measure",
  tags: ["Catalogues", "Measures"],
  summary: "List the enabled field measure catalogues",
  description: "Lists the enabled field measure catalogues on a farm.",
  request: { params: ListEnabledCataloguesParamsSchema },
  responses: {
    200: {
      description: "Enabled field measure catalogues are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

const listCultivationCatalogueRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/cultivation/{source}",
  tags: ["Catalogues", "Cultivations"],
  summary: "List a cultivation catalogue",
  description: "Lists the cultivations in a cultivation catalogue.",
  request: { params: ListCatalogueItemsParamsSchema },
  responses: {
    200: {
      description: "Cultivations in the catalogue are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

const listFertilizerCatalogueRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/fertilizer/{source}",
  tags: ["Catalogues", "Fertilizers"],
  summary: "List a fertilizer catalogue",
  description: "Lists the fertilizers in a fertilizer catalogue.",
  request: { params: ListCatalogueItemsParamsSchema },
  responses: {
    200: {
      description: "Fertilizers in the catalogue are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

const listMeasureCatalogueRoute = createRoute({
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/measure/{source}",
  tags: ["Catalogues", "Measures"],
  summary: "List a field measures catalogue",
  description: "Lists the field measures in a field measure catalogue.",
  request: { params: ListCatalogueItemsParamsSchema },
  responses: {
    200: {
      description: "FIeld measures in the catalogue are listed successfully.",
    },
    ...commonErrorResponses,
  },
})

/**
 * Builds a handler that applies a catalogue service to the farm in the path.
 *
 * @param fdm - Database and service context used by route handlers.
 * @param handler - CRUD function to call with fdm, principal ID, and farm ID.
 * @returns a function that will handle a request context.
 */
export function listEnabledCataloguesRouteHandler(
  fdm: FdmType,
  getter: (fdm: FdmType, principalId: string, b_id_farm: string) => Promise<string[]>,
) {
  return async function (c: any) {
    const params = c.req.valid("param")
    const { b_id_farm } = params as z.infer<typeof ListEnabledCataloguesParamsSchema>
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    const data = await getter(fdm, principal.effectivePrincipalId, b_id_farm)
    return c.json(data)
  }
}

/**
 * Builds a handler that applies a catalogue services to the farm and source in the path.
 *
 * @param fdm - Database and service context used by route handlers.
 * @param catalogueSources - Allowed catalogue descriptions for this endpoint.
 * @param cataloguesGetter - Service to call with fdm, principal ID, and farm ID.
 * @param itemsGetter - Service to call with fdm, principal ID, farm ID, and id of the catalogue.
 * @returns a function that will handle a request context.
 */
export function listItemsInCatalogueRouteHandler(
  fdm: FdmType,
  cataloguesGetter: (fdm: FdmType, principal_id: string, b_id_farm: string) => Promise<string[]>,
  itemsGetter: (fdm: FdmType, principalId: string, sources: string[]) => Promise<any[]>,
) {
  return async function (c: any) {
    const params = c.req.valid("param")
    const { b_id_farm, source } = params as z.infer<typeof ListCatalogueItemsParamsSchema>
    const principal = c.get("principal") as unknown as ApiPrincipalContext
    const catalogueSources = await cataloguesGetter(fdm, principal.effectivePrincipalId, b_id_farm)
    if (!catalogueSources.includes(source)) {
      throw new ApiError(404, "not-found", "Catalogue not enabled on this farm.")
    }
    const data = await itemsGetter(fdm, principal.effectivePrincipalId, [source])
    return c.json(data)
  }
}

/**
 * Registers the catalogue enable and disable routes on the API application.
 *
 * @param app - OpenAPI-enabled Hono application that receives the route registrations.
 * @param fdm - Database and service context used by route handlers.
 * @param services - Catalogue service implementations invoked by the registered handlers.
 * @returns Nothing.
 * @example
 * ```ts
 * registerMeasureRoutes(app, fdm, services)
 * ```
 */
export function registerCatalogueRoutes(
  app: OpenAPIHono<ApiEnv>,
  fdm: FdmType,
  services: CatalogueServices,
): void {
  const listEnabledCultivationCataloguesHandler = listEnabledCataloguesRouteHandler(
    fdm,
    (...args) => services.getEnabledCultivationCatalogues(...args),
  )
  const listEnabledFertilizerCataloguesHandler = listEnabledCataloguesRouteHandler(fdm, (...args) =>
    services.getEnabledFertilizerCatalogues(...args),
  )
  const listEnabledMeasureCataloguesHandler = listEnabledCataloguesRouteHandler(fdm, (...args) =>
    services.getEnabledMeasureCatalogues(...args),
  )
  const listCultivationCatalogueHandler = listItemsInCatalogueRouteHandler(
    fdm,
    (...args) => services.getEnabledCultivationCatalogues(...args),
    (fdm, _principalId, sources) => services.getCultivationsFromCatalogues(fdm, sources),
  )
  const listFertilizerCatalogueHandler = listItemsInCatalogueRouteHandler(
    fdm,
    (...args) => services.getEnabledFertilizerCatalogues(...args),
    (...args) => services.getFertilizersFromCatalogues(...args),
  )
  const listMeasureCatalogueHandler = listItemsInCatalogueRouteHandler(
    fdm,
    (...args) => services.getEnabledMeasureCatalogues(...args),
    // Workaround until a getMeasuresFromCatalogues function is implemented in fdm-core.
    async (fdm, _principalId, sources) =>
      sources.includes("bln") ? await services.getMeasuresFromCatalogue(fdm) : [],
  )
  app.openapi(listAvailableCataloguesRoute, (c) => {
    return c.json(CATALOGUE_SOURCES)
  })
  app.openapi(listEnabledCultivationCataloguesRoute, listEnabledCultivationCataloguesHandler)
  app.openapi(listEnabledFertilizerCataloguesRoute, listEnabledFertilizerCataloguesHandler)
  app.openapi(listEnabledMeasureCataloguesRoute, listEnabledMeasureCataloguesHandler)
  app.openapi(listCultivationCatalogueRoute, listCultivationCatalogueHandler)
  app.openapi(listFertilizerCatalogueRoute, listFertilizerCatalogueHandler)
  app.openapi(listMeasureCatalogueRoute, listMeasureCatalogueHandler)
}
