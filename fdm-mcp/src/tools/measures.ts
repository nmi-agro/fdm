import {
  createMeasure,
  deleteMeasure,
  listFarmGroupMeasures,
  listFarmMeasures,
  listFieldMeasureOptions,
  listFieldMeasures,
  listOrganizationMeasures,
  updateMeasure,
} from "@nmi-agro/fdm-api/operations"
import { type McpTool, operationTool, scopedListTool, scopedTool } from "./types"

/** Tools for measures: agricultural practices on a field, such as a catch crop or buffer strip. */
export const measureTools: McpTool[] = [
  scopedListTool(
    {
      name: "list_measures",
      title: "List measures",
      description:
        "Lists the measures applied on fields, with their id (`b_id_measure`), catalogue id (`m_id`), name and start and end date (YYYY-MM-DD). Give `b_id` for one field, or `b_id_farm` for every field of a farm; optionally within `from`/`to` (YYYY-MM-DD).",
    },
    [
      { scope: "field", operation: listFieldMeasures, key: "b_id" },
      { scope: "farm", operation: listFarmMeasures, key: "b_id_farm" },
    ],
  ),
  scopedTool(
    {
      name: "get_measure_summary",
      title: "Get the measures of a group or organization",
      description:
        "Summarises which measures the farms of a farm group (`b_id_group`) or an organization (`organization_id`) apply in a `year`, and on which farms. Optionally only some farms (`b_id_farm`).",
    },
    [
      { scope: "organization", operation: listOrganizationMeasures, key: "organization_id" },
      { scope: "farm_group", operation: listFarmGroupMeasures, key: "b_id_group" },
    ],
  ),
  operationTool(listFieldMeasureOptions, {
    name: "list_measure_options",
    title: "List measure options for a field",
    description:
      "Lists the measures that suit a field (`b_id`) in a `year`, with their expected effect on the soil quality indicators. Uses the NMI API.",
  }),
  operationTool(createMeasure, {
    name: "create_measure",
    title: "Create a measure",
    description:
      "Records a measure on a field (`b_id`). Find `m_id` with `search_measure_catalogue` or `list_measure_options`, never guess it. Dates are YYYY-MM-DD.",
  }),
  operationTool(updateMeasure, {
    name: "update_measure",
    title: "Update a measure",
    description: "Changes the start or end date (YYYY-MM-DD) of a measure (`b_id_measure`).",
  }),
  operationTool(deleteMeasure, {
    name: "delete_measure",
    title: "Delete a measure",
    description:
      "Permanently deletes a measure. This cannot be undone: always ask the user to confirm first.",
  }),
]
