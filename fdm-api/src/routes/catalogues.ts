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
import {
  commonErrorResponses,
  PaginationQuerySchema,
  paginatedResponse,
  paginatedSchema,
} from "../schemas"

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

const CultivationCatalogueSchema = z
  .looseObject({
    b_lu_catalogue: z.string().openapi({
      title: "Cultivation code in catalogue",
      description: "Catalogue code used to reference this catalogue item in cultivations.",
    }),
    b_lu_source: z.string().openapi({
      title: "Cultivation catalogue source",
      description: "Code of the catalogue this cultivation is from.",
    }),
    b_lu_name: z
      .string()
      .openapi({ title: "Dutch name", description: "Name of this cultivation in Dutch." }),
    b_lu_name_en: z
      .string()
      .nullable()
      .openapi({ title: "English name", description: "Name of this cultivation in English." }),
    b_lu_ya: z.number().array().nullable().openapi({
      title: "Cultivation availability years",
      description:
        "Years this cultivation is available for in the catalogue. A null value means there is no limitation. Also, too recent years that the catalogue has not yet been updated for are always allowed. If present, cultivations that reference this catalogue cultivation cannot be added outside of these years.",
      example: 2024,
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
    b_lu_start_default: z.string().openapi({
      title: "Default sowing date",
      description: "Typical sowing date for this cultivation. In MM-DD format.",
      example: "01-15",
    }), // MM-dd
    b_date_harvest_default: z.string().openapi({
      title: "Default harvest date",
      description: "Typical harvesting date for this cultivation. In MM-DD format.",
      example: "01-15",
    }), // MM-dd
  })
  .openapi("CultivationCatalogue")

export const FertilizerCatalogueSchema = z.looseObject({
  p_id_catalogue: z.string().openapi({
    title: "Fertilizer code in catalogue",
    description: "Catalogue code used to reference this catalogue item in fertilizer applications.",
  }),
  p_source: z.string().openapi({
    title: "Fertilizer catalogue source",
    description:
      "Code of the catalogue this fertilizer is from. For custom fertilizers this is the farm ID.",
  }),
  p_name_nl: z
    .string()
    .openapi({ title: "Dutch name", description: "Name of this fertilizer in Dutch." }),
  p_name_en: z
    .string()
    .nullable()
    .openapi({ title: "English name", description: "Name of this fertilizer in English." }),
  p_description: z
    .string()
    .nullable()
    .openapi({ title: "Description", description: "Further detail about the fertilizer." }),
  // RVO type
  p_type: z.enum(["mineral", "manure", "compost"]).nullable().openapi({
    title: "Fertilizer type",
    description: "Fertilizer type that is relevant for compliance.",
  }),
  p_type_rvo: z.string().nullable().openapi({
    title: "RVO fertilizer code",
    description: "Fertilizer type code according to RVO. It is an integer formatted as a string.",
  }),
  // Flags
  p_type_manure: z
    .boolean()
    .nullable()
    .openapi({ title: "Is manure", description: "Whether this fertilizer is a manure." }),
  p_type_mineral: z.boolean().nullable().openapi({
    title: "Mineral fertilizer",
    description: "Whether this fertilizer is a mineral fertilizer.",
  }),
  p_type_compost: z
    .boolean()
    .nullable()
    .openapi({ title: "Is compost", description: "Whether this fertilizer is a compost." }),
  p_app_method_options: z.string().array().nullable().openapi({
    title: "Application method options",
    description:
      "List of application methods. Pass this as the p_app_method parameter when creating or updating a fertilizer application.",
  }),
  p_app_amount_unit: z.enum(["kg/ha", "l/ha", "ton/ha", "m3/ha"]).openapi({
    title: "Application amount unit",
    description:
      "Unit in which the amount of this fertilizer is entered and displayed when creating or updating an application.",
  }),
  // Chemical properties
  p_dm: z
    .number()
    .nullable()
    .openapi({ title: "Dry matter", description: "Dry matter in g per kg for this fertilizer." }),
  p_density: z
    .number()
    .nullable()
    .openapi({ title: "Density", description: "Density in kg per L for this fertilizer." }),
  p_om: z
    .number()
    .nullable()
    .openapi({ title: "Organic matter", description: "Organic matter content in g per kg." }),
  p_a: z.number().nullable(),
  p_hc: z.number().nullable(),
  p_eom: z.number().nullable().openapi({
    title: "Effective organic matter",
    description: "Effective organic matter content in g per kg.",
  }),
  p_eoc: z.number().nullable().openapi({
    title: "Effective organic carbon",
    description: "Effective organic carbon content in g per kg.",
  }),
  p_c_rt: z.number().nullable(),
  p_c_of: z.number().nullable(),
  p_c_if: z.number().nullable(),
  p_c_fr: z.number().nullable(),
  p_cn_of: z.number().nullable(),
  p_n_rt: z
    .number()
    .nullable()
    .openapi({ title: "Total nitrogen", description: "Total nitrogen content in g N per kg." }),
  p_n_if: z.number().nullable(),
  p_n_of: z.number().nullable(),
  p_n_wc: z.number().nullable().openapi({
    title: "Nitrogen working coefficient",
    description: "Nitrogen working coefficient as a fraction (0–1) of the total nitrogen.",
  }),
  // Nutrient content parameters
  p_no3_rt: z
    .number()
    .nullable()
    .openapi({ title: "Nitrate", description: "Nitrate content in g N per kg." }),
  p_nh4_rt: z
    .number()
    .nullable()
    .openapi({ title: "Ammonium", description: "Ammonium content in g N per kg." }),
  p_p_rt: z
    .number()
    .nullable()
    .openapi({ title: "Phosphate", description: "Total phosphate content in g P2O5 per kg." }),
  p_k_rt: z
    .number()
    .nullable()
    .openapi({ title: "Potassium", description: "Total potassium content in g K2O per kg." }),
  p_mg_rt: z
    .number()
    .nullable()
    .openapi({ title: "Magnesium", description: "Total magnesium content in g MgO per kg." }),
  p_ca_rt: z
    .number()
    .nullable()
    .openapi({ title: "Calcium", description: "Total calcium content in g CaO per kg." }),
  p_ne: z.number().nullable(),
  p_s_rt: z
    .number()
    .nullable()
    .openapi({ title: "Sulphur", description: "Total sulphur content in g SO3 per kg." }),
  p_s_wc: z.number().nullable().openapi({
    title: "Sulphur working coefficient",
    description: "Sulphur working as a fraction (0–1) of the total sulphur.",
  }),
  // Trace nutrient content parameters
  p_cu_rt: z
    .number()
    .nullable()
    .openapi({ title: "Copper", description: "Total copper content in mg Cu per kg." }),
  p_zn_rt: z
    .number()
    .nullable()
    .openapi({ title: "Zinc", description: "Total zinc content in mg Zn per kg." }),
  p_na_rt: z
    .number()
    .nullable()
    .openapi({ title: "Sodium", description: "Total sodium content in g Na2O per kg." }),
  p_si_rt: z
    .number()
    .nullable()
    .openapi({ title: "Silicon", description: "Total silicon content in g per kg." }),
  p_b_rt: z
    .number()
    .nullable()
    .openapi({ title: "Boron", description: "Total boron content in mg B per kg." }),
  p_mn_rt: z
    .number()
    .nullable()
    .openapi({ title: "Manganese", description: "Total manganese content in mg Mn per kg." }),
  p_ni_rt: z
    .number()
    .nullable()
    .openapi({ title: "Nickel", description: "Total nickel content in mg Ni per kg." }),
  p_fe_rt: z
    .number()
    .nullable()
    .openapi({ title: "Iron", description: "Total iron content in mg Fe per kg." }),
  p_mo_rt: z
    .number()
    .nullable()
    .openapi({ title: "Molybdenum", description: "Total molybdenum content in mg Mo per kg." }),
  p_co_rt: z
    .number()
    .nullable()
    .openapi({ title: "Cobalt", description: "Total cobalt content in mg Co per kg." }),
  p_as_rt: z
    .number()
    .nullable()
    .openapi({ title: "Arsenic", description: "Total arsenic content in mg As per kg." }),
  p_cd_rt: z
    .number()
    .nullable()
    .openapi({ title: "Cadmium", description: "Total cadmium content in mg Cd per kg." }),
  p_cr_rt: z
    .number()
    .nullable()
    .openapi({ title: "Chromium", description: "Total chromium content in mg Cr per kg." }),
  p_cr_vi: z.number().nullable().openapi({
    title: "Chromium (VI)",
    description: "Hexavalent chromium content in mg Cr per kg.",
  }),
  p_pb_rt: z
    .number()
    .nullable()
    .openapi({ title: "Lead", description: "Total lead content in mg Pb per kg." }),
  p_hg_rt: z
    .number()
    .nullable()
    .openapi({ title: "Mercury", description: "Total mercury content in mg Hg per kg." }),
  p_cl_rt: z
    .number()
    .nullable()
    .openapi({ title: "Chloride", description: "Total chlorine content in g Cl per kg." }),
  p_ef_nh3: z.number().nullable(),
})
//  .openapi("FertilizerCatalogue")

const MeasureCatalogueSchema = z
  .looseObject({
    m_id: z.string().openapi({
      title: "Field measure code in catalogue",
      description: "Catalogue code used to reference this catalogue item in field measure records.",
    }),
    m_source: z.string().openapi({
      title: "Fertilizer catalogue source",
      description: "The code for the measure's source.",
    }),
    m_name: z.string().openapi({
      title: "Dutch title",
      description: "Name of the measure.",
    }),
    m_description: z.string().nullable().openapi({
      title: "Dutch description",
      description: "Detailed description of the measure and its effects on soil functioning.",
    }),
    m_summary: z.string().openapi({
      title: "Short Dutch description",
      description:
        "A brief description of the measure, ideally no longer than 100 characters. The summary can be used for applications such as tool-tips.",
    }),
    m_source_url: z.string().openapi({
      title: "Source URL",
      description:
        "Url or uri to a source which describes the measure or from which the measure is derived. Indicator calculations that involve this measure are based on this document.",
    }),
    m_conflicts: z.string().array().openapi({
      title: "Conflicting measures",
      description:
        "List of m_ids for measures that cannot be implemented simultaneously with this one.",
    }),
    m_stage_applicability: z.looseObject({}).array().openapi({
      title: "Applicability conditions",
      description:
        "List of conditions determining whether this measure is applicable to a specific field or farm.",
    }),
  })
  .openapi("MeasureCatalogue")

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
  request: { params: ListCatalogueItemsParamsSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: "Cultivations in the catalogue are listed successfully.",
      content: { "application/json": { schema: paginatedSchema(CultivationCatalogueSchema) } },
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
  request: { params: ListCatalogueItemsParamsSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: "Fertilizers in the catalogue are listed successfully.",
      content: { "application/json": { schema: paginatedSchema(FertilizerCatalogueSchema) } },
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
  request: { params: ListCatalogueItemsParamsSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: "Field measures in the catalogue are listed successfully.",
      content: { "application/json": { schema: paginatedSchema(MeasureCatalogueSchema) } },
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
    // fdm-core cannot paginate catalogue queries, so the page is sliced after retrieval.
    const { limit, offset } = c.req.valid("query") as z.infer<typeof PaginationQuerySchema>
    const data = await itemsGetter(fdm, principal.effectivePrincipalId, [source])
    return c.json(paginatedResponse(data, limit, offset))
  }
}

/**
 * Registers the catalogue listing routes on the API application.
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
      (await services.getMeasuresFromCatalogue(fdm)).filter((measure) =>
        sources.includes(measure.m_source),
      ),
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
