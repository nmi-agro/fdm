import type * as core from "@nmi-agro/fdm-core"
import type { FdmType } from "@nmi-agro/fdm-core"
import { z } from "@hono/zod-openapi"
import { ApiError } from "../error"
import {
  CultivationHcat3NameSchema,
  CultivationHcat3Schema,
  fertilizerCompositionDescriptions,
} from "../fields"
import { FarmParamsSchema } from "./farms"
import { defineOperation, type Operation, type OperationContext } from "./types"

/**
 * Defines the catalogue data access functions required by the catalogue operations.
 */
export interface CatalogueServices {
  /** Gets the list of enabled cultivation catalogues on a farm. */
  getEnabledCultivationCatalogues: typeof core.getEnabledCultivationCatalogues
  /** Gets the list of enabled fertilizer catalogues on a farm. */
  getEnabledFertilizerCatalogues: typeof core.getEnabledFertilizerCatalogues
  /** Gets the list of enabled field measure catalogues on a farm. */
  getEnabledMeasureCatalogues: typeof core.getEnabledMeasureCatalogues
  /** Gets the cultivations in a list of catalogues. */
  getCultivationsFromCatalogues: typeof core.getCultivationsFromCatalogues
  /** Gets the fertilizers in a list of catalogues. */
  getFertilizersFromCatalogues: typeof core.getFertilizersFromCatalogues
  /** Gets the BLN3 measures catalogue. */
  getMeasuresFromCatalogue: typeof core.getMeasuresFromCatalogue
}

/** The available catalogues per catalogue type: cultivation, fertilizer or measure. */
export const CatalogueSourcesSchema = z.record(
  z.enum(["cultivation", "fertilizer", "measure"]),
  z
    .array(
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
    )
    .describe("Available catalogues of this type: cultivation, fertilizer or measure."),
)

/** A cultivation in a cultivation catalogue. */
export const CultivationCatalogueSchema = z
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
    b_lu_hcat3: CultivationHcat3Schema,
    b_lu_hcat3_name: CultivationHcat3NameSchema,
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
      title: "Dry matter yield",
      description: "Default value for dry matter yield in kg / ha for this crop.",
    }),
    b_lu_dm: z.number().nullable().openapi({
      title: "Dry matter content",
      description: "Default value for for dry matter content in g / kg for this crop.",
    }),
    b_lu_hi: z.number().nullable().openapi({
      title: "Harvest index",
      description: "Ratio of dry product to the mass of the whole plant above ground.",
    }),
    b_lu_n_harvestable: z.number().nullable().openapi({
      title: "Nitrogen content",
      description:
        "Default value for nitrogen content in g N / kg dm in harvestable parts for this crop.",
    }),
    b_lu_n_residue: z.number().nullable().openapi({
      title: "Nitrogen content of crop residues",
      description:
        "Default value for nitrogen content in g N / kg dm for the residues of this crop.",
    }),
    b_n_fixation: z.number().nullable().openapi({
      title: "Nitrogen fixation",
      description: "Nitrogen fixed in kg per ha by this crop.",
    }),
    b_lu_eom: z.number().nullable().openapi({
      title: "Effective organic matter content",
      description:
        "Default value for effective organic matter content in kg EOM / ha in harvestable parts for this crop.",
    }),
    b_lu_eom_residue: z.number().nullable().openapi({
      title: "Effective organic matter content of crop residues",
      description:
        "Default value for effective organic matter content in kg EOM / ha for the residues of this crop.",
    }),
    b_lu_rest_oravib: z.boolean().nullable().openapi({
      title: "Classification for 'rustgewas'",
      description: "Is the cultivation a 'rustgewas' with regards to Dutch manure legislation.",
    }),
    b_lu_variety_options: z.string().array().nullable().openapi({
      title: "Varieties",
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

/** A fertilizer in a fertilizer catalogue. */
export const FertilizerCatalogueSchema = z
  .looseObject({
    p_id_catalogue: z.string().openapi({
      title: "Fertilizer code in catalogue",
      description:
        "Catalogue code used to reference this catalogue item in fertilizer applications.",
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
    p_type: z.enum(["mineral", "manure", "compost"]).nullable().openapi({
      title: "Fertilizer type",
      description: "Fertilizer type that is relevant for compliance.",
    }),
    p_type_rvo: z.string().nullable().openapi({
      title: "RVO fertilizer code",
      description: "Fertilizer type code according to RVO. It is an integer formatted as a string.",
    }),
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
    p_dm: z.number().nullable().openapi({
      title: "Dry matter",
      description: "Dry matter content in g per kg for this fertilizer.",
    }),
    p_density: z
      .number()
      .nullable()
      .openapi({ title: "Density", description: "Density in kg per L for this fertilizer." }),
    p_om: z
      .number()
      .nullable()
      .openapi({ title: "Organic matter", description: "Organic matter content in g per kg." }),
    p_a: z.number().nullable().describe(fertilizerCompositionDescriptions.p_a),
    p_hc: z.number().nullable().describe(fertilizerCompositionDescriptions.p_hc),
    p_eom: z.number().nullable().openapi({
      title: "Effective organic matter",
      description: "Effective organic matter content in g per kg.",
    }),
    p_eoc: z.number().nullable().openapi({
      title: "Effective organic carbon",
      description: "Effective organic carbon content in g per kg.",
    }),
    p_c_rt: z.number().nullable().describe(fertilizerCompositionDescriptions.p_c_rt),
    p_c_of: z.number().nullable().describe(fertilizerCompositionDescriptions.p_c_of),
    p_c_if: z.number().nullable().describe(fertilizerCompositionDescriptions.p_c_if),
    p_c_fr: z.number().nullable().describe(fertilizerCompositionDescriptions.p_c_fr),
    p_cn_of: z.number().nullable().describe(fertilizerCompositionDescriptions.p_cn_of),
    p_n_rt: z
      .number()
      .nullable()
      .openapi({ title: "Total nitrogen", description: "Total nitrogen content in g N per kg." }),
    p_n_if: z.number().nullable().describe(fertilizerCompositionDescriptions.p_n_if),
    p_n_of: z.number().nullable().describe(fertilizerCompositionDescriptions.p_n_of),
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
    p_ne: z.number().nullable().describe(fertilizerCompositionDescriptions.p_ne),
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
    p_ef_nh3: z.number().nullable().describe(fertilizerCompositionDescriptions.p_ef_nh3),
  })
  .openapi("FertilizerCatalogue")

/** A field measure in a field measure catalogue. */
export const MeasureCatalogueSchema = z
  .looseObject({
    m_id: z.string().openapi({
      title: "Field measure code in catalogue",
      description: "Catalogue code used to reference this catalogue item in field measure records.",
    }),
    m_source: z.string().openapi({
      title: "Measure catalogue source",
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
    m_summary: z.string().nullable().openapi({
      title: "Short Dutch description",
      description:
        "A brief description of the measure, ideally no longer than 100 characters. The summary can be used for applications such as tool-tips. `null` when the catalogue has none.",
    }),
    m_source_url: z.string().nullable().openapi({
      title: "Source URL",
      description:
        "Url or uri to a source which describes the measure or from which the measure is derived. Indicator calculations that involve this measure are based on this document. `null` when the catalogue has none.",
    }),
    m_conflicts: z.string().array().nullable().openapi({
      title: "Conflicting measures",
      description:
        "List of m_ids for measures that cannot be implemented simultaneously with this one. `null` when there are none.",
    }),
    m_stage_applicability: z.enum(["field", "farm"]).nullable().openapi({
      title: "Applicability",
      description:
        "Whether the measure applies to a single field (`field`) or to the whole farm (`farm`). `null` when not set.",
    }),
  })
  .openapi("MeasureCatalogue")

/** The available catalogues per catalogue type. */
export type CatalogueSources = z.infer<typeof CatalogueSourcesSchema>

/** The catalogues that can be enabled on a farm, per catalogue type. */
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

/** Cultivation catalogue source codes enabled on a farm. */
export const EnabledCultivationCataloguesSchema = z.string().array().openapi({
  title: "Enabled cultivation catalogue source codes",
  description: "Cultivation catalogue source codes that have been enabled on this farm.",
})

/** Fertilizer catalogue source codes enabled on a farm. */
export const EnabledFertilizerCataloguesSchema = z.string().array().openapi({
  title: "Enabled fertilizer catalogue source codes",
  description: "Fertilizer catalogue source codes that have been enabled on this farm.",
})

/** Field measure catalogue source codes enabled on a farm. */
export const EnabledMeasureCataloguesSchema = z.string().array().openapi({
  title: "Enabled field measure catalogue source codes",
  description: "Field measure catalogue source codes that have been enabled on this farm.",
})

/** Filters for listing the items of a catalogue. */
export const CatalogueItemsFilterSchema = z.object({
  source: z
    .string()
    .optional()
    .describe(
      "Catalogue source identifier. When omitted, items from all catalogues enabled on the farm are listed.",
    ),
})

/**
 * Input for listing the items of a catalogue: the farm, an optional catalogue source and an
 * optional text search.
 */
export const ListCatalogueItemsInputSchema = FarmParamsSchema.extend(
  CatalogueItemsFilterSchema.shape,
).extend({
  query: z
    .string()
    .optional()
    .describe(
      "Case-insensitive text to search for in the item name or code. Omit to list all items.",
    ),
})

/** Returns the source codes of the catalogues of one type that are enabled on a farm. */
type EnabledCataloguesGetter = (
  services: CatalogueServices,
  fdm: FdmType,
  principalId: string,
  b_id_farm: string,
) => Promise<string[]>

/** Returns the items in the catalogues with the given source codes. */
type CatalogueItemsGetter = (
  services: CatalogueServices,
  fdm: FdmType,
  principalId: string,
  sources: string[],
) => Promise<unknown[]>

/**
 * Builds the operation that lists the enabled catalogues of one type on a farm.
 *
 * @param name - Name of the operation.
 * @param output - Schema of the list of source codes.
 * @param getEnabled - Service call that returns the enabled source codes.
 * @returns The operation.
 */
function defineEnabledCataloguesOperation(
  name: string,
  output: z.ZodArray<z.ZodString>,
  getEnabled: EnabledCataloguesGetter,
) {
  return defineOperation({
    name,
    kind: "read",
    bucket: "general",
    input: FarmParamsSchema,
    output,
    run: async ({ fdm, services, principal }: OperationContext<CatalogueServices>, { b_id_farm }) =>
      getEnabled(services, fdm, principal.effectivePrincipalId, b_id_farm),
  })
}

/**
 * Builds the operation that lists the items in the catalogues of one type that are enabled on a
 * farm, optionally of one catalogue only and optionally filtered by a text search.
 *
 * @param name - Name of the operation.
 * @param item - Schema of a catalogue item.
 * @param getEnabled - Service call that returns the enabled source codes.
 * @param getItems - Service call that returns the items of a list of catalogues.
 * @param searchFields - Item fields that the `query` text is searched in.
 * @returns The operation.
 * @throws {ApiError} 404 when the requested catalogue source is not enabled on the farm.
 */
function defineCatalogueItemsOperation<T extends z.ZodType>(
  name: string,
  item: T,
  getEnabled: EnabledCataloguesGetter,
  getItems: CatalogueItemsGetter,
  searchFields: readonly string[],
): Operation<typeof ListCatalogueItemsInputSchema, z.ZodArray<T>, CatalogueServices> {
  return defineOperation({
    name,
    kind: "read",
    bucket: "general",
    input: ListCatalogueItemsInputSchema,
    output: z.array(item),
    run: async (
      { fdm, services, principal }: OperationContext<CatalogueServices>,
      { b_id_farm, source, query },
    ) => {
      const catalogueSources = await getEnabled(
        services,
        fdm,
        principal.effectivePrincipalId,
        b_id_farm,
      )
      if (source && !catalogueSources.includes(source)) {
        throw new ApiError(404, "not-found", "Catalogue not enabled on this farm.")
      }
      // fdm-core cannot paginate catalogue queries, so callers slice the page after retrieval.
      const items = await getItems(
        services,
        fdm,
        principal.effectivePrincipalId,
        source ? [source] : catalogueSources,
      )
      const needle = query?.trim().toLowerCase()
      const matches = needle
        ? items.filter((entry) =>
            searchFields.some((field) => {
              const value = (entry as Record<string, unknown>)[field]
              return typeof value === "string" && value.toLowerCase().includes(needle)
            }),
          )
        : items
      return matches as z.infer<T>[]
    },
  })
}

/** Lists the cultivation, fertilizer and field measure catalogues that can be enabled on a farm. */
export const listCatalogues = defineOperation({
  name: "listCatalogues",
  kind: "read",
  bucket: "general",
  input: z.object({}),
  output: CatalogueSourcesSchema,
  run: async (_ctx: OperationContext<CatalogueServices>) => CATALOGUE_SOURCES,
})

/** Lists the source codes of the cultivation catalogues enabled on a farm. */
export const listFarmCultivationCatalogues = defineEnabledCataloguesOperation(
  "listFarmCultivationCatalogues",
  EnabledCultivationCataloguesSchema,
  (services, ...args) => services.getEnabledCultivationCatalogues(...args),
)

/** Lists the source codes of the fertilizer catalogues enabled on a farm. */
export const listFarmFertilizerCatalogues = defineEnabledCataloguesOperation(
  "listFarmFertilizerCatalogues",
  EnabledFertilizerCataloguesSchema,
  (services, ...args) => services.getEnabledFertilizerCatalogues(...args),
)

/** Lists the source codes of the field measure catalogues enabled on a farm. */
export const listFarmMeasureCatalogues = defineEnabledCataloguesOperation(
  "listFarmMeasureCatalogues",
  EnabledMeasureCataloguesSchema,
  (services, ...args) => services.getEnabledMeasureCatalogues(...args),
)

/**
 * Lists the cultivations in the cultivation catalogues enabled on a farm. `query` searches the
 * Dutch and English name and the catalogue code.
 */
export const listCultivationCatalogueItems = defineCatalogueItemsOperation(
  "listCultivationCatalogueItems",
  CultivationCatalogueSchema,
  (services, ...args) => services.getEnabledCultivationCatalogues(...args),
  (services, fdm, _principalId, sources) => services.getCultivationsFromCatalogues(fdm, sources),
  ["b_lu_name", "b_lu_name_en", "b_lu_catalogue"],
)

/**
 * Lists the fertilizers in the fertilizer catalogues enabled on a farm. `query` searches the
 * Dutch and English name and the catalogue code.
 */
export const listFertilizerCatalogueItems = defineCatalogueItemsOperation(
  "listFertilizerCatalogueItems",
  FertilizerCatalogueSchema,
  (services, ...args) => services.getEnabledFertilizerCatalogues(...args),
  (services, ...args) => services.getFertilizersFromCatalogues(...args),
  ["p_name_nl", "p_name_en", "p_id_catalogue"],
)

/**
 * Lists the field measures in the field measure catalogues enabled on a farm. `query` searches
 * the name and the measure code.
 */
export const listMeasureCatalogueItems = defineCatalogueItemsOperation(
  "listMeasureCatalogueItems",
  MeasureCatalogueSchema,
  (services, ...args) => services.getEnabledMeasureCatalogues(...args),
  // Workaround until a getMeasuresFromCatalogues function is implemented in fdm-core.
  async (services, fdm, _principalId, sources) =>
    (await services.getMeasuresFromCatalogue(fdm)).filter((measure) =>
      sources.includes(measure.m_source),
    ),
  ["m_name", "m_id"],
)
