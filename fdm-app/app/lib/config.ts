import type { ClientConfig } from "~/types/config.d"

declare global {
    interface Window {
        __RUNTIME_CONFIG__?: RuntimeConfig
    }
}

// Define a function to initialize the runtime environment map
const initializeRuntimeEnvMap = (): RuntimeConfig => {
    // On the client, __RUNTIME_CONFIG__ is populated by the root loader.
    // biome-ignore lint/complexity/useOptionalChain: Is required to run
    if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__) {
        return window.__RUNTIME_CONFIG__
    }

    // On the server (SSR context for routes like welcome.tsx, or other server-side uses):
    // We need to construct a config map that mirrors what the root loader provides.
    // Prioritize process.env for known public variables, then fallback to import.meta.env.
    // This ensures consistency between SSR and client-side hydration.
    const env: Partial<RuntimeConfig> = {}

    // These are the keys that root.tsx loader includes in runtimeEnv
    const keysToProcess: Array<keyof RuntimeConfig> = [
        "PUBLIC_FDM_URL",
        "PUBLIC_FDM_NAME",
        "PUBLIC_FDM_DATASETS_URL",
        "PUBLIC_FDM_DATASETS_URL",
        "PUBLIC_MAP_PROVIDER",
        "PUBLIC_MAPTILER_API_KEY",
        "PUBLIC_SENTRY_DSN",
        "PUBLIC_SENTRY_ORG",
        "PUBLIC_SENTRY_PROJECT",
        "PUBLIC_SENTRY_TRACE_SAMPLE_RATE",
        "PUBLIC_SENTRY_REPLAY_SAMPLE_RATE",
        "PUBLIC_SENTRY_REPLAY_SAMPLE_RATE_ON_ERROR",
        "PUBLIC_SENTRY_PROFILE_SAMPLE_RATE",
        "PUBLIC_SENTRY_SECURITY_REPORT_URI",
        "PUBLIC_POSTHOG_KEY",
        "PUBLIC_POSTHOG_HOST",
    ]

    for (const key of keysToProcess) {
        const stringKey = key as string // Explicit cast for indexing

        if (
            typeof process !== "undefined" &&
            process.env &&
            process.env[stringKey] !== undefined
        ) {
            env[key] = process.env[stringKey]
        } else if (import.meta.env[stringKey] !== undefined) {
            env[key] = import.meta.env[stringKey] as any
        }
    }

    return env as RuntimeConfig
}

const runtimeEnvMap: RuntimeConfig = initializeRuntimeEnvMap()

// Helper to get config value from the runtimeEnvMap
const getConfigValue = (
    key: keyof RuntimeConfig,
    defaultValue?: RuntimeConfig[keyof RuntimeConfig],
) => {
    const value = runtimeEnvMap[key]
    return typeof value !== "undefined" ? value : defaultValue
}

// Read Sentry config
const sentryDsn = getConfigValue("PUBLIC_SENTRY_DSN")
const sentryOrg = getConfigValue("PUBLIC_SENTRY_ORG")
const sentryProject = getConfigValue("PUBLIC_SENTRY_PROJECT")

const sentryConfig =
    sentryDsn && sentryOrg && sentryProject
        ? {
              dsn: String(sentryDsn),
              organization: String(sentryOrg),
              project: String(sentryProject),
              trace_sample_rate: Number(
                  getConfigValue("PUBLIC_SENTRY_TRACE_SAMPLE_RATE", 1),
              ),
              replay_sample_rate: Number(
                  getConfigValue("PUBLIC_SENTRY_REPLAY_SAMPLE_RATE", 0),
              ),
              replay_sample_rate_on_error: Number(
                  getConfigValue(
                      "PUBLIC_SENTRY_REPLAY_SAMPLE_RATE_ON_ERROR",
                      1,
                  ),
              ),
              profile_sample_rate: Number(
                  getConfigValue("PUBLIC_SENTRY_PROFILE_SAMPLE_RATE", 1),
              ),
              security_report_uri: String(
                  getConfigValue("PUBLIC_SENTRY_SECURITY_REPORT_URI", ""),
              ),
          }
        : null

// Read PostHog config
const posthogKey = getConfigValue("PUBLIC_POSTHOG_KEY")
const posthogHost = getConfigValue("PUBLIC_POSTHOG_HOST")
const posthogConfig =
    posthogKey && posthogHost && String(posthogKey).startsWith("phc_")
        ? { key: String(posthogKey), host: String(posthogHost) }
        : null

// Export the client-safe config object
export const clientConfig: ClientConfig = {
    name: String(getConfigValue("PUBLIC_FDM_NAME", "FDM")),
    logo: "/fdm-high-resolution-logo-transparent.png", // Assuming static
    logomark: "/fdm-high-resolution-logo-transparent-no-text.png", // Assuming static
    url: String(getConfigValue("PUBLIC_FDM_URL")),
    datasets_url: String(getConfigValue("PUBLIC_FDM_DATASETS_URL")),

    analytics: {
        sentry: sentryConfig,
        posthog: posthogConfig,
    },
    integrations: {
        map: {
            provider: getConfigValue("PUBLIC_MAP_PROVIDER", "osm") as
                | "maptiler"
                | "osm",
            maptilerKey: String(getConfigValue("PUBLIC_MAPTILER_API_KEY", "")),
        },
    },
}
