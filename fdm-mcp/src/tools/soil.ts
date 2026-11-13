import {
  createSoilAnalysis,
  deleteSoilAnalysis,
  getFarmCurrentSoilData,
  getFieldCurrentSoilData,
  getFieldCurrentSoilDataPerZone,
  listFarmSoilAnalyses,
  listFieldSoilAnalyses,
  updateSoilAnalysis,
} from "@nmi-agro/fdm-api/operations"
import { z } from "zod"
import { type McpTool, operationTool, scopedListTool } from "./types"

/** Tools for soil: soil analyses and the current soil data derived from them. */
export const soilTools: McpTool[] = [
  scopedListTool(
    {
      name: "get_current_soil_data",
      title: "Get current soil data",
      description:
        "Returns the most recent value of every soil parameter (for example pH, organic matter %, P-AL mg P2O5/100 g, clay %), with its date (YYYY-MM-DD), source and depth (cm). Give `b_id` for one field (add `per_zone: true` for the values per sampling zone of the field), or `b_id_farm` for every field of a farm (optionally within `from`/`to`).",
    },
    [
      {
        scope: "field_zones",
        operation: getFieldCurrentSoilDataPerZone,
        when: (args) => args.b_id !== undefined && args.per_zone === true,
      },
      { scope: "field", operation: getFieldCurrentSoilData, key: "b_id" },
      { scope: "farm", operation: getFarmCurrentSoilData, key: "b_id_farm" },
    ],
    {
      per_zone: z
        .boolean()
        .optional()
        .describe("With `b_id`: return the values per sampling zone of the field."),
    },
  ),
  scopedListTool(
    {
      name: "list_soil_analyses",
      title: "List soil analyses",
      description:
        "Lists soil analyses with their id (`a_id`), sampling date and depth, source (lab) and measured parameters. Give `b_id` for one field, or `b_id_farm` for every field of a farm (optionally within `from`/`to`, YYYY-MM-DD).",
    },
    [
      { scope: "field", operation: listFieldSoilAnalyses, key: "b_id" },
      { scope: "farm", operation: listFarmSoilAnalyses, key: "b_id_farm" },
    ],
  ),
  operationTool(createSoilAnalysis, {
    name: "create_soil_analysis",
    title: "Create a soil analysis",
    description:
      "Adds a soil analysis to a field (`b_id`): the source (`a_source`, the lab), analysis and sampling dates (YYYY-MM-DD), depth in cm and the measured parameters with the units in their descriptions. Only give the parameters the lab reported. When the values come from a lab report the user gave you, convert them to the units of the schema and let the user check them before you save.",
  }),
  operationTool(updateSoilAnalysis, {
    name: "update_soil_analysis",
    title: "Update a soil analysis",
    description:
      "Changes values of a soil analysis (`a_id`). Only the parameters you pass are changed.",
  }),
  operationTool(deleteSoilAnalysis, {
    name: "delete_soil_analysis",
    title: "Delete a soil analysis",
    description:
      "Permanently deletes a soil analysis. This cannot be undone: always ask the user to confirm first.",
  }),
]
