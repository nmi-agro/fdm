import {
  addFarmToGroup,
  createFarmGroup,
  deleteFarmGroup,
  getFarmGroup,
  listFarmGroups,
  removeFarmFromGroup,
  updateFarmGroup,
} from "@nmi-agro/fdm-api/operations"
import { listTool, type McpTool, operationTool } from "./types"

/** Tools for farm groups: named sets of farms within an organization, such as a study group. */
export const farmGroupTools: McpTool[] = [
  listTool(listFarmGroups, {
    name: "list_farm_groups",
    title: "List farm groups",
    description:
      "Lists the farm groups of an organization (`organization_id`) with their id (`b_id_group`), name and member farms.",
  }),
  operationTool(getFarmGroup, {
    name: "get_farm_group",
    title: "Get a farm group",
    description:
      "Returns one farm group (`b_id_group`) with its member farms and the dates they joined and left (YYYY-MM-DD).",
  }),
  operationTool(createFarmGroup, {
    name: "create_farm_group",
    title: "Create a farm group",
    description:
      "Creates a farm group with a name (`b_name_group`) in an organization (`organization_id`). Add farms with `add_farm_to_group`.",
  }),
  operationTool(updateFarmGroup, {
    name: "update_farm_group",
    title: "Rename a farm group",
    description: "Changes the name (`b_name_group`) of a farm group (`b_id_group`).",
  }),
  operationTool(deleteFarmGroup, {
    name: "delete_farm_group",
    title: "Delete a farm group",
    description:
      "Deletes a farm group. The farms themselves are kept. Always ask the user to confirm first.",
  }),
  operationTool(addFarmToGroup, {
    name: "add_farm_to_group",
    title: "Add a farm to a group",
    description:
      "Adds a farm (`b_id_farm`) to a farm group (`b_id_group`), optionally from a join date and until a leave date (YYYY-MM-DD).",
  }),
  operationTool(removeFarmFromGroup, {
    name: "remove_farm_from_group",
    title: "Remove a farm from a group",
    description:
      "Ends the membership of a farm (`b_id_farm`) in a farm group (`b_id_group`), on `b_group_leaved` (YYYY-MM-DD) or today. The farm itself is kept. Ask the user to confirm first.",
  }),
]
