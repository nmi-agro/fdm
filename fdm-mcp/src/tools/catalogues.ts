import {
  FarmParamsSchema,
  listCatalogues,
  listCultivationCatalogueItems,
  listFarmCultivationCatalogues,
  listFarmFertilizerCatalogues,
  listFarmMeasureCatalogues,
  listFertilizerCatalogueItems,
  listMeasureCatalogueItems,
} from "@nmi-agro/fdm-api/operations"
import { z } from "zod"
import { listTool, type McpTool } from "./types"

const EnabledCataloguesSchema = z.object({
  cultivation: listFarmCultivationCatalogues.output.describe(
    "Sources of the cultivation catalogues enabled on the farm.",
  ),
  fertilizer: listFarmFertilizerCatalogues.output.describe(
    "Sources of the fertilizer catalogues enabled on the farm.",
  ),
  measure: listFarmMeasureCatalogues.output.describe(
    "Sources of the measure catalogues enabled on the farm.",
  ),
})

/**
 * Lists the catalogue sources: all that exist, or those enabled on a farm. Combines four
 * operations into one tool.
 */
const listCataloguesTool: McpTool = {
  name: "list_catalogues",
  title: "List catalogues",
  description:
    "Lists the catalogues of cultivations, fertilizers and measures. Without arguments: all catalogue sources with their names. With `b_id_farm`: the sources enabled on that farm, which the search tools use.",
  kind: "read",
  bucket: "general",
  external: false,
  operations: [
    listCatalogues.name,
    listFarmCultivationCatalogues.name,
    listFarmFertilizerCatalogues.name,
    listFarmMeasureCatalogues.name,
  ],
  input: z.object({
    b_id_farm: FarmParamsSchema.shape.b_id_farm
      .optional()
      .describe("Unique identifier of the farm. Omit to list all catalogue sources."),
  }),
  output: z.object({
    scope: z
      .enum(["available", "enabled"])
      .describe("`available`: all catalogue sources; `enabled`: the sources enabled on the farm."),
    result: z
      .union([listCatalogues.output, EnabledCataloguesSchema])
      .describe("The catalogue sources."),
  }),
  run: async (ctx, args) => {
    const { b_id_farm } = args as { b_id_farm?: string }
    if (!b_id_farm) {
      return { scope: "available", result: await listCatalogues.run(ctx, {}) }
    }
    const [cultivation, fertilizer, measure] = await Promise.all([
      listFarmCultivationCatalogues.run(ctx, { b_id_farm }),
      listFarmFertilizerCatalogues.run(ctx, { b_id_farm }),
      listFarmMeasureCatalogues.run(ctx, { b_id_farm }),
    ])
    return { scope: "enabled", result: { cultivation, fertilizer, measure } }
  },
}

/** Tools to find codes in the catalogues of cultivations, fertilizers and measures. */
export const catalogueTools: McpTool[] = [
  listCataloguesTool,
  listTool(listCultivationCatalogueItems, {
    name: "search_cultivation_catalogue",
    title: "Search the cultivation catalogue",
    description:
      "Searches the cultivation catalogues enabled on a farm (`b_id_farm`) by name or code (`query`, case-insensitive, Dutch or English, for example 'grasland' or 'mais'). Returns the `b_lu_catalogue` codes that `create_cultivation` needs.",
  }),
  listTool(listFertilizerCatalogueItems, {
    name: "search_fertilizer_catalogue",
    title: "Search the fertilizer catalogue",
    description:
      "Searches the fertilizer catalogues enabled on a farm (`b_id_farm`) by name or code (`query`, case-insensitive, Dutch or English, for example 'rundveedrijfmest' or 'KAS'). Returns the `p_id_catalogue` codes and compositions that `create_fertilizer` needs.",
  }),
  listTool(listMeasureCatalogueItems, {
    name: "search_measure_catalogue",
    title: "Search the measure catalogue",
    description:
      "Searches the measure catalogues enabled on a farm (`b_id_farm`) by name or code (`query`, case-insensitive). Returns the `m_id` codes that `create_measure` needs.",
  }),
]
