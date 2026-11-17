import type { McpServer } from "@modelcontextprotocol/server"
import type { ApiPrincipalContext } from "@nmi-agro/fdm-api"
import { instrument, type PostHog } from "@posthog/mcp"

/**
 * Settings for PostHog MCP analytics. Without them, the server sends no analytics.
 */
export interface McpAnalyticsConfig {
  /** A `posthog-node` client, created once per process. */
  posthog: PostHog
  /** Immutable build identifier, such as a release or commit, sent as `$mcp_server_build`. */
  serverBuild?: string
}

/**
 * Event properties that would contain farm data: tool arguments and results, and error
 * messages. They are removed from every event before it leaves the server.
 */
export const PRIVATE_EVENT_PROPERTIES = [
  "$mcp_parameters",
  "$mcp_response",
  "$mcp_error_message",
  "$exception_list",
] as const

/**
 * Removes farm data from an analytics event before it is sent: drops `$exception` events (errors
 * go to Sentry) and deletes {@link PRIVATE_EVENT_PROPERTIES} from every other event.
 *
 * @param event - The event PostHog is about to send.
 * @returns The event without private properties, or `null` to drop it.
 */
export function scrubEvent<E extends { event: string; properties: Record<string, unknown> }>(
  event: E,
): E | null {
  if (event.event === "$exception") return null
  for (const property of PRIVATE_EVENT_PROPERTIES) {
    delete event.properties[property]
  }
  return event
}

/**
 * Instruments an MCP server with PostHog MCP analytics for one authenticated request.
 *
 * Events are tied to the user (`distinct_id` is the user id, the same id the web app uses) and
 * record the tool, client, latency and outcome. The agent's intent (`context` argument) and
 * reports of missing tools (`get_more_tools`) are captured. The intent is free text written by the
 * assistant and is sent as it is: it can contain names of farms, fields or people that the
 * conversation mentions. Tool arguments, results and error messages are removed; errors go to
 * Sentry instead.
 *
 * @param server - The MCP server of the request, before tools are registered.
 * @param config - The PostHog client and build identifier.
 * @param principal - The authenticated principal of the request.
 */
export function instrumentAnalytics(
  server: McpServer,
  config: McpAnalyticsConfig,
  principal: ApiPrincipalContext,
): void {
  instrument(server, config.posthog, {
    identify: { distinctId: principal.userId },
    context: true,
    enableConversationId: true,
    reportMissing: true,
    enableExceptionAutocapture: false,
    ...(config.serverBuild ? { serverBuild: config.serverBuild.slice(0, 256) } : {}),
    beforeSend: scrubEvent,
  })
}
