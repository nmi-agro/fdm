import * as Sentry from "@sentry/react-router"
import mapLibreStyle from "maplibre-gl/dist/maplibre-gl.css?url"
import posthog from "posthog-js"
import { useEffect } from "react"
import type { LinksFunction, LoaderFunctionArgs } from "react-router"
import {
    data,
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    redirect,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useLocation,
} from "react-router"
import { getToast } from "remix-toast"
import { toast as notify } from "sonner"
import { Banner } from "~/components/custom/banner"
import { ErrorBlock } from "~/components/custom/error"
import { NavigationProgress } from "~/components/custom/navigation-progress"
import { Toaster } from "~/components/ui/sonner"
import { clientConfig } from "~/lib/config"
import { useChangelogStore } from "~/store/changelog"
import styles from "~/tailwind.css?url"
import type { Route } from "./+types/root"

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
            PUBLIC_MAP_PROVIDER: process.env.PUBLIC_MAP_PROVIDER,
            PUBLIC_MAPTILER_API_KEY: process.env.PUBLIC_MAPTILER_API_KEY,
            PUBLIC_SENTRY_DSN: process.env.PUBLIC_SENTRY_DSN,
            PUBLIC_SENTRY_ORG: process.env.PUBLIC_SENTRY_ORG,
            PUBLIC_SENTRY_PROJECT: process.env.PUBLIC_SENTRY_PROJECT,
            PUBLIC_SENTRY_TRACE_SAMPLE_RATE:
                process.env.PUBLIC_SENTRY_TRACE_SAMPLE_RATE,
            PUBLIC_SENTRY_REPLAY_SAMPLE_RATE:
                process.env.PUBLIC_SENTRY_REPLAY_SAMPLE_RATE,
            PUBLIC_SENTRY_REPLAY_SAMPLE_RATE_ON_ERROR:
                process.env.PUBLIC_SENTRY_REPLAY_SAMPLE_RATE_ON_ERROR,
            PUBLIC_SENTRY_PROFILE_SAMPLE_RATE:
                process.env.PUBLIC_SENTRY_PROFILE_SAMPLE_RATE,
            PUBLIC_SENTRY_SECURITY_REPORT_URI:
                process.env.PUBLIC_SENTRY_SECURITY_REPORT_URI,
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
                    loaded: () => {},
                })
            } catch (error) {
                console.error("Failed to initialize PostHog:", error)
            }
        }
    }, [])

    // Capture pageviews if PostHog is configured
    // biome-ignore lint/correctness/useExhaustiveDependencies: This is a false positive: the useEffect should run whenever the location changes to capture new pageviews correctly
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
            notify.error(toast.message, {
                duration: 30000,
            })
        }
        if (toast && toast.type === "warning") {
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
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <script
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Polyfill for Maplibre and other libs expecting global
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
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: This is safe because we are stringifying a JSON object
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify(runtimeEnv).replace(
                                /</g,
                                "\\u003c",
                            ),
                        }}
                    />
                )}
                <script
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: This is safe because we are stringifying a JSON object
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
 * Renders an error boundary that handles and displays error information based on the provided error.
 *
 * This component distinguishes between route error responses and generic errors:
 * - For route errors:
 *   - Redirects to the signin page if the error status is 401.
 *   - Renders a 404 error block for client errors with status 400, 403, or 404.
 *   - Logs other route errors to the error tracking service and renders an error block reflecting the specific status.
 * - For generic Error instances, it logs the error and renders a 500 error block with the error message and stack trace.
 * - If the error is null, no error UI is rendered.
 * - For any other cases, it logs the error and displays an error block with a 500 status and a generic message.
 *
 * @param error - The error encountered during route processing, either as a route error response or a generic Error.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    const location = useLocation()
    const page = location.pathname
    const timestamp = new Date().toISOString()

    if (isRouteErrorResponse(error)) {
        // Redirect to signin page if authentication is not provided
        if (error.status === 401) {
            // Get the current path the user tried to access
            const currentPath =
                location.pathname + location.search + location.hash
            // Construct the sign-in URL with the redirectTo parameter
            const signInUrl = `./signin?redirectTo=${encodeURIComponent(currentPath)}`
            // Throw the redirect response to be caught by React Router
            throw redirect(signInUrl)
        }

        const clientErrors = [400, 403, 404]
        if (clientErrors.includes(error.status)) {
            return (
                <ErrorBlock
                    status={404} // Show 404 in case user is not authorized to access page
                    message={error.statusText}
                    stacktrace={error.data}
                    page={page}
                    timestamp={timestamp}
                />
            )
        }

        // Server-side errors are already captured in Sentry via handleError / reportError.
        // No need to capture again client-side.
        return (
            <ErrorBlock
                status={error.status}
                message={error.statusText}
                stacktrace={error.data}
                page={page}
                timestamp={timestamp}
            />
        )
    }
    if (error instanceof Error) {
        // Client-side JS error — not captured server-side, so capture here.
        Sentry.captureException(error)
        return (
            <ErrorBlock
                status={500}
                message={error.message}
                stacktrace={error.stack}
                page={page}
                timestamp={timestamp}
            />
        )
    }
    if (error === null) {
        return null
    }

    Sentry.captureException(error)
    return (
        <ErrorBlock
            status={500}
            message="Unknown Error"
            stacktrace={null}
            page={page}
            timestamp={timestamp}
        />
    )
}
