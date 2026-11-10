import {
  createFarm,
  deleteFarm,
  getFarm,
  listFarms,
  updateFarm,
} from "@nmi-agro/fdm-api/operations"
import { listTool, type McpTool, operationTool } from "./types"

/** Tools for farms: the top-level records that own fields, fertilizers and other data. */
export const farmTools: McpTool[] = [
  listTool(listFarms, {
    name: "list_farms",
    title: "List farms",
    description:
      "Lists the farms the user can access, with their id (`b_id_farm`), name, business id and address. Start here to find the `b_id_farm` that other tools need. Optionally only the farms of a farm group (`b_id_group`).",
  }),
  operationTool(getFarm, {
    name: "get_farm",
    title: "Get a farm",
    description: "Returns one farm by its id (`b_id_farm`): name, business id and address.",
  }),
  operationTool(createFarm, {
    name: "create_farm",
    title: "Create a farm",
    description:
      "Creates a new farm owned by the user and enables the default catalogues of cultivations, fertilizers and measures. Returns the new farm with its `b_id_farm`. A user can create at most 10 farms per 24 hours.",
  }),
  operationTool(updateFarm, {
    name: "update_farm",
    title: "Update a farm",
    description:
      "Changes the name, business id, address or postal code of a farm. Only the fields you pass are changed.",
  }),
  operationTool(deleteFarm, {
    name: "delete_farm",
    title: "Delete a farm",
    description:
      "Permanently deletes a farm with all its fields, cultivations, harvests, fertilizer applications and soil analyses. This cannot be undone: always ask the user to confirm first.",
  }),
]
