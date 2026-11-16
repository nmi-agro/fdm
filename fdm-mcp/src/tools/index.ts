import type { McpTool } from "./types"
import { calculationTools } from "./calculations"
import { catalogueTools } from "./catalogues"
import { cultivationTools } from "./cultivations"
import { farmGroupTools } from "./farm-groups"
import { farmStatusTools } from "./farm-status"
import { farmTools } from "./farms"
import { fertilizerTools } from "./fertilizers"
import { fieldTools } from "./fields"
import { measureTools } from "./measures"
import { soilTools } from "./soil"

/**
 * All tools of the MCP server, in the order that `tools/list` returns them: first the farm and
 * its fields, then what happens on the fields, then calculations and catalogues.
 */
export const TOOLS: readonly McpTool[] = [
  ...farmTools,
  ...farmGroupTools,
  ...fieldTools,
  ...cultivationTools,
  ...fertilizerTools,
  ...soilTools,
  ...measureTools,
  ...farmStatusTools,
  ...calculationTools,
  ...catalogueTools,
]

export { EXCLUDED_OPERATIONS } from "./excluded"
export { annotationsFor, listTool, operationTool, scopedListTool, scopedTool } from "./types"
export type { McpTool, ToolContext, ToolMeta, ToolVariant } from "./types"
