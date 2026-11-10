import type { McpTool } from "./types"
import { farmTools } from "./farms"
import { fieldTools } from "./fields"

/**
 * All tools of the MCP server, in the order that `tools/list` returns them.
 */
export const TOOLS: readonly McpTool[] = [...farmTools, ...fieldTools]

export { annotationsFor, listTool, operationTool } from "./types"
export type { McpTool, ToolContext, ToolMeta } from "./types"
