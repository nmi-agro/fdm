import type { LinksFunction, LoaderFunctionArgs } from "react-router"
import { withAuditContext } from "@nmi-agro/fdm-core"
import mapLibreStyle from "maplibre-gl/dist/maplibre-gl.css?url"
import posthog from "posthog-js"
import { useEffect } from "react"
import {
  data,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router"
import { getToast } from "remix-toast"
import { toast as notify } from "sonner"
import { Banner } from "~/components/custom/banner"
import { RouteErrorFallback } from "~/components/custom/error"
import { NavigationProgress } from "~/components/custom/navigation-progress"
import { Toaster } from "~/components/ui/sonner"
import { auth } from "~/lib/auth.server"
import { clientConfig } from "~/lib/config"
import { useChangelogStore } from "~/store/changelog"
import styles from "~/tailwind.css?url"
import type { Route } from "./+types/root"

export const middleware: Route.MiddlewareFunction[] = [
  async function auditMiddleware({ request }, next) {
    let credential_id: string | undefined
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      })
      credential_id = session?.session?.id
    } catch {
      // Session lookup failure is non-fatal; proceed without credential context
    }
    return withAuditContext({ channel: "app", credential_id }, () => next())
  },
]

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: mapLibreStyle },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
]

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { toast, headers } = await getToast(request)

    // Prepare runtime environment variables for the client
    const runtimeEnv = {
      PUBLIC_FDM_URL: process.env.PUBLIC_FDM_URL,
      PUBLIC_FDM_NAME: process.env.PUBLIC_FDM_NAME,
      PUBLIC_FDM_DATASETS_URL: process.env.PUBLIC_FDM_DATASETS_URL,
      PUBLIC_FDM_API_URL: process.env.PUBLIC_FDM_API_URL,
      PUBLIC_MAP_PROVIDER: process.env.PUBLIC_MAP_PROVIDER,
      PUBLIC_MAPTILER_API_KEY: process.env.PUBLIC_MAPTILER_API_KEY,
      PUBLIC_SENTRY_DSN: process.env.PUBLIC_SENTRY_DSN,
      PUBLIC_SENTRY_ORG: process.env.PUBLIC_SENTRY_ORG,
      PUBLIC_SENTRY_PROJECT: process.env.PUBLIC_SENTRY_PROJECT,
      PUBLIC_SENTRY_TRACE_SAMPLE_RATE: process.env.PUBLIC_SENTRY_TRACE_SAMPLE_RATE,
      PUBLIC_SENTRY_REPLAY_SAMPLE_RATE: process.env.PUBLIC_SENTRY_REPLAY_SAMPLE_RATE,
      PUBLIC_SENTRY_REPLAY_SAMPLE_RATE_ON_ERROR:
        process.env.PUBLIC_SENTRY_REPLAY_SAMPLE_RATE_ON_ERROR,
      PUBLIC_SENTRY_PROFILE_SAMPLE_RATE: process.env.PUBLIC_SENTRY_PROFILE_SAMPLE_RATE,
      PUBLIC_SENTRY_SECURITY_REPORT_URI: process.env.PUBLIC_SENTRY_SECURITY_REPORT_URI,
      PUBLIC_POSTHOG_KEY: process.env.PUBLIC_POSTHOG_KEY,
      PUBLIC_POSTHOG_HOST: process.env.PUBLIC_POSTHOG_HOST,
    }

    return data({ toast, runtimeEnv }, { headers })
  } catch (error) {
    console.error("Failed to get toast or runtimeEnv:", error)
    // Fallback for runtimeEnv if process.env access fails or is not desired here for some reason
    const runtimeEnvFallback = {
      // Provide fallbacks or leave undefined if config.ts handles undefined from window object
    }
    return data({ toast: null, runtimeEnv: runtimeEnvFallback }, {})
  }
}

export function Layout() {
  const loaderData = useLoaderData<typeof loader>()
  const toast = loaderData?.toast
  const runtimeEnv = loaderData?.runtimeEnv // Get runtimeEnv from loader data
  const location = useLocation()

  // Initialize PostHog
  useEffect(() => {
    const posthogConfig = clientConfig.analytics.posthog
    if (posthogConfig) {
      try {
        posthog.init(posthogConfig.key, {
          api_host: "/ingest",
          ui_host: posthogConfig.host,
          person_profiles: "always",
          bootstrap: {
            featureFlags: {
              gerrit: false,
              mineralization: false,
            },
          },
          loaded: () => {},
        })
      } catch (error) {
        console.error("Failed to initialize PostHog:", error)
      }
    }
  }, [])

  // Capture pageviews if PostHog is configured
  useEffect(() => {
    if (clientConfig.analytics.posthog && typeof window !== "undefined") {
      posthog.capture("$pageview")
    }
  }, [location])

  // Initialize changelog store
  useEffect(() => {
    useChangelogStore.getState().initializeChangelog()
  }, [])

  // Hook to show the toasts
  useEffect(() => {
    if (toast && toast.type === "error") {
      const status = typeof toast.status === "number" ? toast.status : null
      const errorId = typeof toast.errorId === "string" ? toast.errorId : null

      if (clientConfig.analytics.posthog) {
        posthog.capture("unexpected_error_toast_shown", {
          status,
          errorId,
          page: window.location.pathname,
        })
      }

      notify.error(toast.message, {
        duration: 30000,
        action: {
          label: "Kopieer",
          onClick: () => {
            const errorDetails = JSON.stringify(
              {
                status,
                message: toast.message,
                stacktrace: errorId ? `ErrorId: ${errorId}` : null,
                page: window.location.pathname,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            )
            navigator.clipboard
              .writeText(errorDetails)
              .then(() => notify.success("Foutmelding gekopieerd naar klembord"))
              .catch(() =>
                notify.error(
                  `Kopiëren niet gelukt. Stuur foutcode ${errorId} op naar Ondersteuning.`,
                ),
              )
          },
        },
      })
    }
    if (toast && toast.type === "warning") {
      const status = typeof toast.status === "number" ? toast.status : null
      if (status !== null && clientConfig.analytics.posthog) {
        posthog.capture("client_error_toast_shown", {
          status,
          page: window.location.pathname,
        })
      }
      notify.warning(toast.message)
    }
    if (toast && toast.type === "success") {
      notify.success(toast.message)
    }
    if (toast && toast.type === "info") {
      notify.info(toast.message)
    }
  }, [toast])

  return (
    <html lang="nl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <script
          dangerouslySetInnerHTML={{
            __html: "window.global = window;",
          }}
        />
        <Links />
      </head>
      <body>
        <Outlet />
        <NavigationProgress />
        <Banner />
        <Toaster />
        <ErrorBoundary error={null} params={{}} />
        <ScrollRestoration
          getKey={(location) => {
            return location.pathname
          }}
        />
        {/* Inject runtime environment variables */}
        {runtimeEnv && (
          <script
            id="runtime-config"
            type="application/json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(runtimeEnv).replace(/</g, "\\u003c"),
            }}
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
                            try {
                                const configScript = document.getElementById('runtime-config');
                                window.__RUNTIME_CONFIG__ = configScript ? JSON.parse(configScript.textContent) : {};
                            } catch (e) {
                                console.warn('Failed to parse runtime config:', e);
                                window.__RUNTIME_CONFIG__ = {};
                            }
                        `,
          }}
        />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Layout />
}

/**
 * Renders an error boundary that classifies and displays the current route error. Delegates all
 * classification to {@link RouteErrorFallback} (redirect for 401, the friendly, generic page for
 * client errors 400/403/404, or the diagnostic page for anything else, including a `null` error
 * — this component is also rendered unconditionally inside `Layout` below with `error={null}`).
 *
 * @param error - The error encountered during route processing, either as a route error response or a generic Error.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RouteErrorFallback error={error} />
}
