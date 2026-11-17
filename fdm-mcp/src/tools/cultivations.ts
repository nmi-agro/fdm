import {
  createCultivation,
  createHarvest,
  deleteCultivation,
  deleteHarvest,
  getCultivationHarvestParameters,
  listCultivationHarvests,
  listFarmCultivations,
  listFarmHarvests,
  listFieldCultivations,
  updateCultivation,
  updateHarvest,
} from "@nmi-agro/fdm-api/operations"
import { type McpTool, operationTool, scopedListTool } from "./types"

/** Tools for cultivations (crops on a field) and their harvests. */
export const cultivationTools: McpTool[] = [
  scopedListTool(
    {
      name: "list_cultivations",
      title: "List cultivations",
      description:
        "Lists cultivations (crops) with their id (`b_lu`), catalogue code (`b_lu_catalogue`), name, and start and end date (YYYY-MM-DD). Give `b_id` for one field, or `b_id_farm` for every field of a farm.",
    },
    [
      { scope: "field", operation: listFieldCultivations, key: "b_id" },
      { scope: "farm", operation: listFarmCultivations, key: "b_id_farm" },
    ],
  ),
  operationTool(createCultivation, {
    name: "create_cultivation",
    title: "Create a cultivation",
    description:
      "Adds a cultivation (crop) to a field (`b_id`). Find `b_lu_catalogue` with `search_cultivation_catalogue`, never guess it. Dates are YYYY-MM-DD.",
  }),
  operationTool(updateCultivation, {
    name: "update_cultivation",
    title: "Update a cultivation",
    description:
      "Changes the crop, dates, variety or crop residue setting of a cultivation (`b_lu`). Only the fields you pass are changed. Dates are YYYY-MM-DD.",
  }),
  operationTool(deleteCultivation, {
    name: "delete_cultivation",
    title: "Delete a cultivation",
    description:
      "Permanently deletes a cultivation with its harvests. This cannot be undone: always ask the user to confirm first.",
  }),
  scopedListTool(
    {
      name: "list_harvests",
      title: "List harvests",
      description:
        "Lists harvests with their id (`b_id_harvesting`), date (YYYY-MM-DD) and yield and quality values in the units of their descriptions (for example kg DM/ha). Give `b_lu` for one cultivation, or `b_id_farm` for the whole farm; optionally within `from`/`to` (YYYY-MM-DD).",
    },
    [
      { scope: "cultivation", operation: listCultivationHarvests, key: "b_lu" },
      { scope: "farm", operation: listFarmHarvests, key: "b_id_farm" },
    ],
  ),
  operationTool(getCultivationHarvestParameters, {
    name: "get_harvest_parameters",
    title: "Get harvest parameters",
    description:
      "Returns which yield and quality parameters a harvest of this cultivation (`b_lu`) takes. Call it before `create_harvest`.",
  }),
  operationTool(createHarvest, {
    name: "create_harvest",
    title: "Create a harvest",
    description:
      "Adds a harvest to a cultivation (`b_lu`) on `b_lu_harvest_date` (YYYY-MM-DD), with the yield and quality values that `get_harvest_parameters` lists, in the units of their descriptions.",
  }),
  operationTool(updateHarvest, {
    name: "update_harvest",
    title: "Update a harvest",
    description:
      "Changes the date or the yield and quality values of a harvest (`b_id_harvesting`).",
  }),
  operationTool(deleteHarvest, {
    name: "delete_harvest",
    title: "Delete a harvest",
    description:
      "Permanently deletes a harvest. This cannot be undone: always ask the user to confirm first.",
  }),
]
