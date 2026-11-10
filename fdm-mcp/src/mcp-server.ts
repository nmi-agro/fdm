import type { ApiPrincipalContext, FdmApiServices } from "@nmi-agro/fdm-api"
import type { FdmType } from "@nmi-agro/fdm-core"
import { McpServer } from "@modelcontextprotocol/server"
import type { McpTool, ToolContext } from "./tools/types"
import { type McpAnalyticsConfig, instrumentAnalytics } from "./analytics"
import { callTool } from "./call-tool"
import { buildInstructions } from "./instructions"
import { registerResources } from "./resources"
import { annotationsFor, TOOLS } from "./tools"
import { SERVER_VERSION } from "./version"

/**
 * Largest number of array elements and object members in the arguments of one tool call. A field
 * boundary has at most 10,000 coordinates, which is about 30,000 elements.
 */
const MAX_TOOL_INPUT_ELEMENTS = 50_000

/** Everything needed to build the MCP server for one request. */
export interface McpServerSetup {
  /** Public name of the application, used as server name and in the instructions. */
  appName: string
  /** Database. */
  fdm: FdmType
  /** Data-access functions. */
  services: FdmApiServices
  /** The authenticated principal of the request. */
  principal: ApiPrincipalContext
  /** PostHog MCP analytics; omitted to send no analytics. */
  analytics?: McpAnalyticsConfig
  /** The tools to register. Defaults to all tools. */
  tools?: readonly McpTool[]
}

/**
 * Builds the MCP server for one authenticated request, with all tools, the resource templates
 * and the server instructions. The server is stateless: a new one is built for every request.
 *
 * @param setup - The request's principal, database, services and analytics.
 * @returns The MCP server.
 */
export function createMcpServer(setup: McpServerSetup): McpServer {
  const server = new McpServer(
    { name: setup.appName, version: SERVER_VERSION },
    {
      instructions: buildInstructions(setup.appName),
      maxToolInputElements: MAX_TOOL_INPUT_ELEMENTS,
    },
  )
  if (setup.analytics) {
    instrumentAnalytics(server, setup.analytics, setup.principal)
  }
  const ctx: ToolContext = {
    fdm: setup.fdm,
    services: setup.services,
    principal: setup.principal,
  }
  for (const tool of setup.tools ?? TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: annotationsFor(tool),
      },
      async (args: unknown) => callTool(tool, ctx, args),
    )
  }
  registerResources(server, ctx)
  return server
}
