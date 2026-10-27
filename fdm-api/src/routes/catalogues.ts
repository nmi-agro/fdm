import type { OpenAPIHono } from "@hono/zod-openapi"
import { createRoute, z } from "@hono/zod-openapi"
import {
  getMeasuresFromCatalogue,
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

const CatalogueSourcesSchema = z.record(
  z.enum(["cultivation", "fertilizer", "measure"]),
  z.array(
    z.object({
      source: z.string().openapi({
        title: "Catalogue source code",
        description: "Code to call other catalogue endpoints with.",
      }),
      title: z.string().openapi({
        title: "Catalogue source title",
        description: "Full name of the source of the catalogue data so you can look it up.",
      }),
    }),
  ),
)

const CultivationCatalogueSchema = z.looseObject({
  b_lu_catalogue: z.string(),
  b_lu_source: z.string(),
  b_lu_name: z.string(),
  b_lu_name_en: z.string().nullable(),
  b_lu_ya: z.number().array().nullable().openapi({
    title: "Cultivation availability years",
    description:
      "Years this cultivation is available for in the catalogue. A null value means there is no limitation. Also, too recent years that the catalogue has not yet been updated for are always allowed. If present, cultivations that reference this catalogue cultivation cannot be added outside of these years.",
  }),
  b_lu_harvestable: z.enum(["once", "multiple", "none"]).openapi({
    title: "Cultivation harvestability",
    description:
      "For how many times the cultivation can be harvested for. If a cultivation's corresponding catalogue cultivation can only be harvested, up to one harvest event will be allowed which will be kept in sync with the cultivation end date. Harvests will not be allowed at all if the catalogue cultivation is not harvestable.",
  }),
  b_lu_harvestcat: z
    .enum([
      "HC010", // Standard
      "HC020", // Grass
      "HC031", // Maize
      "HC040", // Root crops
      "HC041", // Sugar beets
      "HC042", // Potatoes
      "HC050", // Cereals
    ])
    .openapi({
      title: "Harvest category",
      description:
        "Harvest category mainly used to determine the interesting harvest analysis parameters for a harvest event. HC020 for grass, HC031 for maize, HC040 for root crops, HC041 for sugar beet, HC042 for potatoes, and HC050 for cereals.",
    }),
  b_lu_hcat3: z.string().nullable(),
  b_lu_hcat3_name: z.string().nullable(),
  b_lu_croprotation: z
    .enum([
      "other",
      "clover",
      "nature",
      "potato",
      "grass",
      "rapeseed",
      "starch",
      "maize",
      "cereal",
      "sugarbeet",
      "alfalfa",
      "catchcrop",
    ])
    .nullable()
    .openapi({
      title: "Crop category by crop rotation",
      description: "Crop category used during agronomic planning of farm activities.",
    }),
  b_lu_yield: z.number().nullable().openapi({
    title: "Total yield",
    description: "Standard dry yield in kg per ha for this crop.",
  }),
  b_lu_dm: z.number().nullable().openapi({
    title: "Dry matter yield",
    description: "Standard dry matter yield in g per kg of dry product for this crop.",
  }),
  b_lu_hi: z.number().nullable().openapi({
    title: "Harvest index",
    description: "Ratio of dry product to the mass of the whole plant above ground.",
  }),
  b_lu_n_harvestable: z.number().nullable().openapi({
    title: "Nitrogen yield",
    description: "Nitrogen yield in g per kg of dry product for this crop.",
  }),
  b_lu_n_residue: z.number().nullable().openapi({
    title: "Nitrogen residue",
    description:
      "Nitrogen residue in g per kg of dry residue left on the ground after the harvest.",
  }),
  b_n_fixation: z.number().nullable().openapi({
    title: "Nitrogen fixation",
    description: "Nitrogen fixed in kg per ha by this crop.",
  }),
  b_lu_eom: z.number().nullable(),
  b_lu_eom_residue: z.number().nullable(),
  b_lu_rest_oravib: z.boolean().nullable().openapi({
    title: "Is rest crop",
    description:
      "A value of true means that a significant part of the living plant is left over after the harvest.",
  }),
  b_lu_variety_options: z.string().array().nullable().openapi({
    title: "Cultivars",
    description:
      "List of varieties that can be selected for this crop. The variety should be passed in the `b_lu_variety` parameter when creating or updating a cultivation.",
  }),
  b_lu_start_default: z.string().date().openapi({
    title: "Default sowing date",
    description: "Typical sowing date for this cultivation.",
    example: "2024-01-15",
  }), // MM-dd
  b_date_harvest_default: z.string().date().openapi({
    title: "Default harvest date",
    description: "Typical harvesting date for this cultivation.",
    example: "2024-01-15",
  }), // MM-dd
})

const FertilizerCatalogueSchema = z.looseObject({})

const MeasureCatalogueSchema = z.looseObject({})

type CatalogueSources = z.infer<typeof CatalogueSourcesSchema>

export const CATALOGUE_SOURCES: CatalogueSources = {
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
}

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
  method: "get",
  path: "/farms/{b_id_farm}/catalogues/cultivation",
  tags: ["Catalogues", "Cultivations"],
  summary: "List the enabled cultivation catalogues",
  description: "Lists the enabled cultivation catalogues on a farm.",
  request: { params: ListEnabledCataloguesParamsSchema },
  responses: {
    200: {
      description: "Enabled cultivation catalogues are listed successfully.",
      content: {
        "application/json": {
          schema: z.string().array().openapi({
            title: "Enabled cultivation catalogue source codes",
            description: "Cultivation catalogue source codes that have been enabled on this farm.",
          }),
        },
      },
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
      content: {
        "application/json": {
          schema: z.string().array().openapi({
            title: "Enabled fertilizer catalogue source codes",
            description: "Fertilizer catalogue source codes that have been enabled on this farm.",
          }),
        },
      },
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
      content: {
        "application/json": {
          schema: z.string().array().openapi({
            title: "Enabled field measure catalogue source codes",
            description:
              "Field measure catalogue source codes that have been enabled on this farm.",
          }),
        },
      },
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
      content: { "application/json": { schema: CultivationCatalogueSchema.array() } },
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
      content: { "application/json": { schema: FertilizerCatalogueSchema.array() } },
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
      content: { "application/json": { schema: MeasureCatalogueSchema.array() } },
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
    return c.json(CATALOGUE_SOURCES, 200)
  })
  app.openapi(listEnabledCultivationCataloguesRoute, listEnabledCultivationCataloguesHandler)
  app.openapi(listEnabledFertilizerCataloguesRoute, listEnabledFertilizerCataloguesHandler)
  app.openapi(listEnabledMeasureCataloguesRoute, listEnabledMeasureCataloguesHandler)
  app.openapi(listCultivationCatalogueRoute, listCultivationCatalogueHandler)
  app.openapi(listFertilizerCatalogueRoute, listFertilizerCatalogueHandler)
  app.openapi(listMeasureCatalogueRoute, listMeasureCatalogueHandler)
}
