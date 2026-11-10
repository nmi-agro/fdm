import {
  createField,
  deleteField,
  getField,
  listFields,
  updateField,
} from "@nmi-agro/fdm-api/operations"
import { listTool, type McpTool, operationTool } from "./types"

/** Tools for fields: the parcels of a farm, with their boundary as GeoJSON. */
export const fieldTools: McpTool[] = [
  listTool(listFields, {
    name: "list_fields",
    title: "List fields",
    description:
      "Lists the fields of a farm (`b_id_farm`) with their id (`b_id`), name, area (ha), boundary as GeoJSON and the period the farm manages them (dates as YYYY-MM-DD).",
  }),
  operationTool(getField, {
    name: "get_field",
    title: "Get a field",
    description:
      "Returns one field by its id (`b_id`): name, area (ha), perimeter (m), boundary as GeoJSON (WGS84 longitude/latitude), and start and end date (YYYY-MM-DD).",
  }),
  operationTool(createField, {
    name: "create_field",
    title: "Create a field",
    description:
      "Adds a field to a farm (`b_id_farm`). The boundary is a GeoJSON Polygon or MultiPolygon in WGS84 longitude/latitude with at most 10,000 coordinates. Dates are YYYY-MM-DD. A farm can have at most 500 fields.",
  }),
  operationTool(updateField, {
    name: "update_field",
    title: "Update a field",
    description:
      "Changes the name, boundary, dates or other properties of a field (`b_id`). Only the fields you pass are changed. Dates are YYYY-MM-DD.",
  }),
  operationTool(deleteField, {
    name: "delete_field",
    title: "Delete a field",
    description:
      "Permanently deletes a field with its cultivations, harvests, fertilizer applications and soil analyses. This cannot be undone: always ask the user to confirm first.",
  }),
]
