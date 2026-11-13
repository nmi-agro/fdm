import {
  createCustomFertilizer,
  createFertilizer,
  createFertilizerApplication,
  deleteFertilizer,
  deleteFertilizerApplication,
  listFarmFertilizerApplications,
  listFarmFertilizers,
  listFieldFertilizerApplications,
  updateCustomFertilizer,
  updateFertilizerApplication,
} from "@nmi-agro/fdm-api/operations"
import { listTool, type McpTool, operationTool, scopedListTool } from "./types"

/** Tools for the fertilizers of a farm and their applications on fields. */
export const fertilizerTools: McpTool[] = [
  listTool(listFarmFertilizers, {
    name: "list_fertilizers",
    title: "List fertilizers",
    description:
      "Lists the fertilizers available on a farm (`b_id_farm`) with their id (`p_id`), name, type and composition (for example N, P2O5 and K2O in g/kg). Use `p_id` in `create_fertilizer_application`.",
  }),
  operationTool(createFertilizer, {
    name: "create_fertilizer",
    title: "Add a fertilizer from the catalogue",
    description:
      "Adds a fertilizer from a catalogue to a farm (`b_id_farm`). Find `p_id_catalogue` with `search_fertilizer_catalogue`, never guess it. Optionally the acquired amount (kg) and date (YYYY-MM-DD).",
  }),
  operationTool(createCustomFertilizer, {
    name: "create_custom_fertilizer",
    title: "Create a custom fertilizer",
    description:
      "Creates a fertilizer that is not in a catalogue, for example a farm's own manure with a lab analysis, and adds it to the farm (`b_id_farm`). Give at least the name (`p_name_nl`) and the composition values that are known, in the units of their descriptions.",
  }),
  operationTool(updateCustomFertilizer, {
    name: "update_custom_fertilizer",
    title: "Update a custom fertilizer",
    description:
      "Changes the name or composition of a custom fertilizer (`p_id`). Catalogue fertilizers cannot be changed. Only the fields you pass are changed.",
  }),
  operationTool(deleteFertilizer, {
    name: "delete_fertilizer",
    title: "Delete a fertilizer",
    description:
      "Removes a fertilizer (`p_id`) from the farm. This cannot be undone: always ask the user to confirm first.",
  }),
  scopedListTool(
    {
      name: "list_fertilizer_applications",
      title: "List fertilizer applications",
      description:
        "Lists fertilizer applications with their id (`p_app_id`), fertilizer (`p_id`), amount, method and date (YYYY-MM-DD). Give `b_id` for one field, or `b_id_farm` for every field of a farm; optionally within `from`/`to` (YYYY-MM-DD).",
    },
    [
      { scope: "field", operation: listFieldFertilizerApplications, key: "b_id" },
      { scope: "farm", operation: listFarmFertilizerApplications, key: "b_id_farm" },
    ],
  ),
  operationTool(createFertilizerApplication, {
    name: "create_fertilizer_application",
    title: "Create a fertilizer application",
    description:
      "Records that a fertilizer (`p_id`, from `list_fertilizers`) was applied on a field (`b_id`) on `p_app_date` (YYYY-MM-DD), with the amount in the unit of the fertilizer (see `p_app_amount_unit`, for example kg/ha or m3/ha) and the application method.",
  }),
  operationTool(updateFertilizerApplication, {
    name: "update_fertilizer_application",
    title: "Update a fertilizer application",
    description:
      "Changes the fertilizer, amount, method or date of a fertilizer application (`p_app_id`). Only the fields you pass are changed.",
  }),
  operationTool(deleteFertilizerApplication, {
    name: "delete_fertilizer_application",
    title: "Delete a fertilizer application",
    description:
      "Permanently deletes a fertilizer application. This cannot be undone: always ask the user to confirm first.",
  }),
]
