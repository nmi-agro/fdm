import type { ActionFunction, LoaderFunction } from "react-router"
import { serverConfig } from "~/lib/config.server"
import { proxyToPosthog } from "~/lib/posthog-proxy.server"

// In production `server.js` proxies /ingest before React Router handles the request. This route
// serves the same proxy for `react-router dev`, which does not run `server.js`.
const posthogProxy = async (request: Request) => {
  if (!serverConfig.analytics.posthog) {
    return new Response(null, { status: 204 })
  }
  return proxyToPosthog(
    {
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body: request.body,
    },
    serverConfig.analytics.posthog.host,
  )
}

export const loader: LoaderFunction = async ({ request }) => posthogProxy(request)

export const action: ActionFunction = async ({ request }) => posthogProxy(request)
