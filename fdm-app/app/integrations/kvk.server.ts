import { serverConfig } from "~/lib/config.server"
import { createKvkClient, type KvkClient } from "./kvk/client.server"

export * from "./kvk/client.server"

let client: KvkClient | undefined

/**
 * Returns the KvK client configured with `KVK_API_KEY` and `KVK_API_BASE_URL`.
 *
 * @returns The client, or undefined when the KvK integration is not configured.
 */
export function getKvkClient(): KvkClient | undefined {
  const config = serverConfig.integrations.kvk
  if (!config) return undefined
  client ??= createKvkClient({ apiKey: config.api_key, baseUrl: config.base_url })
  return client
}

/**
 * Whether the KvK lookup is available in this environment.
 *
 * @returns True when `KVK_API_KEY` is set.
 */
export function isKvkConfigured(): boolean {
  return serverConfig.integrations.kvk !== undefined
}
