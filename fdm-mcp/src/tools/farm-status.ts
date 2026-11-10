import {
  createDerogation,
  createOrganicCertification,
  deleteDerogation,
  deleteGrazingIntention,
  deleteOrganicCertification,
  listDerogations,
  listGrazingIntentions,
  listOrganicCertifications,
  setGrazingIntention,
} from "@nmi-agro/fdm-api/operations"
import { listTool, type McpTool, operationTool } from "./types"

/**
 * Tools for the legal status of a farm per year: organic certification, derogation and grazing
 * intention. These affect the fertilization norms.
 */
export const farmStatusTools: McpTool[] = [
  listTool(listOrganicCertifications, {
    name: "list_organic_certifications",
    title: "List organic certifications",
    description:
      "Lists the organic certifications of a farm (`b_id_farm`) with their id (`b_id_organic`), TRACES and SKAL numbers and issue and expiry date (YYYY-MM-DD).",
  }),
  operationTool(createOrganicCertification, {
    name: "create_organic_certification",
    title: "Add an organic certification",
    description:
      "Adds an organic certification to a farm (`b_id_farm`) with issue and expiry date (YYYY-MM-DD) and optionally the TRACES and SKAL numbers.",
  }),
  operationTool(deleteOrganicCertification, {
    name: "delete_organic_certification",
    title: "Delete an organic certification",
    description:
      "Permanently deletes an organic certification. Always ask the user to confirm first.",
  }),
  listTool(listDerogations, {
    name: "list_derogations",
    title: "List derogations",
    description:
      "Lists the years for which a farm (`b_id_farm`) has a derogation (permission to apply more nitrogen from manure), with their id (`b_id_derogation`).",
  }),
  operationTool(createDerogation, {
    name: "create_derogation",
    title: "Add a derogation",
    description:
      "Records that a farm (`b_id_farm`) has a derogation for a year (`b_derogation_year`).",
  }),
  operationTool(deleteDerogation, {
    name: "delete_derogation",
    title: "Delete a derogation",
    description: "Deletes a derogation (`b_id_derogation`). Always ask the user to confirm first.",
  }),
  listTool(listGrazingIntentions, {
    name: "list_grazing_intentions",
    title: "List grazing intentions",
    description:
      "Lists per year whether a farm (`b_id_farm`) intends to graze its animals (`b_grazing_intention`).",
  }),
  operationTool(setGrazingIntention, {
    name: "set_grazing_intention",
    title: "Set the grazing intention",
    description:
      "Sets for a year (`b_grazing_intention_year`) whether a farm (`b_id_farm`) intends to graze (`b_grazing_intention`: true or false). Replaces an earlier value for that year.",
  }),
  operationTool(deleteGrazingIntention, {
    name: "delete_grazing_intention",
    title: "Delete a grazing intention",
    description:
      "Removes the grazing intention of a farm (`b_id_farm`) for a year. Always ask the user to confirm first.",
  }),
]
